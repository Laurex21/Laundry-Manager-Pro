import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useForm } from "react-hook-form";
import { Cog, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import type { Machine } from "@shared/schema";

export default function Machines() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);

  if (!hasFeature("machines")) {
    return <UpgradePrompt title={t("machines")} description="Track your machine fleet, utilization rates and maintenance." requiredPlan="Pro" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-machines-title">{t("machines")}</h1>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-lg shadow-primary/25" data-testid="button-add-machine">
          <Plus className="w-4 h-4 mr-2" /> {t("add_machine")}
        </Button>
      </div>

      <MachineList onEdit={(m) => { setEditing(m); setOpen(true); }} />

      <MachineDialog open={open} onOpenChange={setOpen} machine={editing} />
    </div>
  );
}

function MachineList({ onEdit }: { onEdit: (m: Machine) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: machines, isLoading } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/machines/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/machines"] }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  if (!machines || machines.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
        <Cog className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p data-testid="text-no-machines">{t("no_machines_yet")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {machines.map((machine) => {
        const utilization = Number(machine.utilizationRate);
        const utilColor = utilization >= 70 ? "bg-green-500" : utilization >= 40 ? "bg-yellow-500" : "bg-red-500";
        const statusColor = machine.status === "active" ? "default" : machine.status === "maintenance" ? "secondary" : "outline";
        const typeLabel = machine.type.charAt(0).toUpperCase() + machine.type.slice(1);

        return (
          <Card key={machine.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-machine-${machine.id}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{machine.name}</h3>
                <Badge variant={statusColor as any} data-testid={`badge-status-${machine.id}`}>
                  {machine.status}
                </Badge>
              </div>
              <Badge variant="outline">{typeLabel}</Badge>
              <div className="text-sm text-muted-foreground">{t("capacity_kg")}: {machine.capacityKg} kg</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{t("utilization")}</span>
                  <span>{utilization}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${utilColor} rounded-full transition-all`} style={{ width: `${Math.min(100, utilization)}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("cycles")}: {machine.cycleCount}</span>
                <span>{t("total_kg")}: {machine.totalKgProcessed}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(machine)} data-testid={`button-edit-machine-${machine.id}`}>
                  <Pencil className="w-3 h-3 mr-1" /> {t("edit")}
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this machine?")) deleteMutation.mutate(machine.id); }} data-testid={`button-delete-machine-${machine.id}`}>
                  <Trash2 className="w-3 h-3 mr-1" /> {t("delete")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MachineDialog({ open, onOpenChange, machine }: { open: boolean; onOpenChange: (v: boolean) => void; machine: Machine | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      name: machine?.name || "",
      type: machine?.type || "washer",
      capacityKg: machine?.capacityKg || "0",
      status: machine?.status || "active",
    },
  });

  const isEdit = !!machine;

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) return apiRequest("PATCH", `/api/machines/${machine!.id}`, data);
      return apiRequest("POST", "/api/machines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      onOpenChange(false);
      form.reset();
    },
  });

  if (open && machine && form.getValues("name") !== machine.name) {
    form.reset({ name: machine.name, type: machine.type, capacityKg: machine.capacityKg, status: machine.status });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("edit") : t("add_machine")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField control={form.control} name="name" rules={{ required: true }} render={({ field }) => (
              <FormItem>
                <FormLabel>{t("machine_name")}</FormLabel>
                <FormControl><Input {...field} data-testid="input-machine-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("machine_type")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-machine-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="washer">Washer</SelectItem>
                    <SelectItem value="dryer">Dryer</SelectItem>
                    <SelectItem value="press">Press</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="capacityKg" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("capacity_kg")}</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-machine-capacity" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("machine_status")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-machine-status"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-machine">
              {mutation.isPending ? "Saving..." : isEdit ? t("save_changes") : t("add_machine")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
