import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useForm } from "react-hook-form";
import { Activity, Cog, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Machine } from "@shared/schema";
import { ProductionCycleBoard } from "@/components/production-cycle-board";

export default function Machines() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
  const [usageTarget, setUsageTarget] = useState<Machine | null>(null);

  if (!hasFeature("machines")) {
    return <UpgradePrompt title={t("machines")} description="Track your machine fleet, utilization rates and maintenance." requiredPlan="Pro" />;
  }

  return (
    <div className="space-y-6 page-fade-in" data-testid="machines-page-redesign">
      <section className="rounded-2xl border border-[#082D5B]/10 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Cog className="h-4 w-4" />
            {t("production", "Production")}
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#082D5B]" data-testid="text-machines-title">{t("machines")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("machines_page_subtitle", "Suivez la disponibilité, l'utilisation et la maintenance de votre parc.")}</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-lg shadow-primary/25" data-testid="button-add-machine">
          <Plus className="w-4 h-4 mr-2" /> {t("add_machine")}
        </Button>
      </div>
      </section>

      <MachineList
        onEdit={(m) => { setEditing(m); setOpen(true); }}
        onDelete={setDeleteTarget}
        onUsage={setUsageTarget}
      />

      <ProductionCycleBoard />

      <MachineDialog open={open} onOpenChange={setOpen} machine={editing} />
      <MachineUsageDialog
        open={!!usageTarget}
        onOpenChange={(v) => { if (!v) setUsageTarget(null); }}
        machine={usageTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")} {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_service_confirm", { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <DeleteMachineAction machine={deleteTarget} onDone={() => setDeleteTarget(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteMachineAction({ machine, onDone }: { machine: Machine | null; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/machines/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/machines"] }); onDone(); },
  });

  return (
    <AlertDialogAction
      className="bg-destructive text-destructive-foreground"
      disabled={deleteMutation.isPending}
      onClick={() => machine && deleteMutation.mutate(machine.id)}
    >
      {deleteMutation.isPending ? t("deleting") : t("delete")}
    </AlertDialogAction>
  );
}

function statusVariant(status: string) {
  if (status === "active") return "default";
  if (status === "maintenance") return "secondary";
  return "outline";
}

function MachineList({ onEdit, onDelete, onUsage }: { onEdit: (m: Machine) => void; onDelete: (m: Machine) => void; onUsage: (m: Machine) => void }) {
  const { t } = useTranslation();
  const { data: machines, isLoading } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
      </div>
    );
  }

  if (!machines || machines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#082D5B]/20 bg-card px-6 py-16 text-center text-muted-foreground">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Cog className="h-7 w-7" />
        </div>
        <p className="font-semibold text-[#082D5B]" data-testid="text-no-machines">{t("no_machines_yet")}</p>
        <p className="mx-auto mt-1 max-w-md text-sm">{t("machines_empty_hint", "Ajoutez votre première machine pour suivre les cycles, la capacité et les maintenances.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#082D5B]/10 bg-card shadow-sm divide-y divide-[#082D5B]/10">
      <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_3fr_1fr_auto] gap-4 px-4 py-3 bg-[#082D5B] text-xs font-semibold uppercase tracking-wider text-white">
        <span>{t("machine_name")}</span>
        <span>{t("machine_type")}</span>
        <span>{t("machine_status")}</span>
        <span>{t("utilization")}</span>
        <span>{t("cycles")}</span>
        <span></span>
      </div>
      {machines.map((machine) => {
        const utilization = Number(machine.utilizationRate);
        const utilColor = utilization >= 70 ? "bg-green-500" : utilization >= 40 ? "bg-yellow-500" : "bg-red-500";
        const typeLabel = t(`machine_type_${machine.type}`, machine.type.charAt(0).toUpperCase() + machine.type.slice(1));

        return (
          <div key={machine.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_3fr_1fr_auto] gap-x-4 gap-y-3 px-4 py-4 items-center hover:bg-primary/[0.035] transition-colors sm:gap-y-1 sm:py-3" data-testid={`card-machine-${machine.id}`}>
            <div className="min-w-0">
              <span className="font-medium text-sm block truncate">{machine.name}</span>
              {(machine.brand || machine.model) && <span className="text-xs text-muted-foreground truncate block">{[machine.brand, machine.model].filter(Boolean).join(" ")}</span>}
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">{t("machine_type")}</span>
              <span className="text-sm text-muted-foreground">{typeLabel}</span>
            </div>
            <span>
              <Badge variant={statusVariant(machine.status) as any} className="text-xs" data-testid={`badge-status-${machine.id}`}>
                {t(`machine_status_${machine.status}`, machine.status)}
              </Badge>
            </span>
            <div className="rounded-lg bg-muted/35 p-3 sm:bg-transparent sm:p-0">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">{t("utilization")}</span>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${utilColor} rounded-full transition-all`} style={{ width: `${Math.min(100, utilization)}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 shrink-0">{utilization}%</span>
            </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <span>{machine.cycleCount}</span>
              <span className="text-muted-foreground/50 mx-1">/</span>
              <span>{machine.totalKgProcessed} kg</span>
            </div>
            <div className="flex gap-1 justify-end border-t pt-3 sm:border-0 sm:pt-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUsage(machine)} title={t("machine_usage", "Utilisation")} data-testid={`button-machine-usage-${machine.id}`}>
                <Activity className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(machine)} data-testid={`button-edit-machine-${machine.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(machine)} data-testid={`button-delete-machine-${machine.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function todayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function MachineUsageDialog({ open, onOpenChange, machine }: { open: boolean; onOpenChange: (v: boolean) => void; machine: Machine | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      machineId: machine?.id || 0,
      usageDate: todayDate(),
      orderId: "",
      weightProcessed: "",
      cycleDurationMinutes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/machines/${machine!.id}/usage`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/advanced"] });
      onOpenChange(false);
      form.reset({ machineId: machine?.id || 0, usageDate: todayDate(), orderId: "", weightProcessed: "", cycleDurationMinutes: "" });
    },
  });

  if (open && machine && form.getValues("machineId") !== machine.id) {
    form.reset({ machineId: machine.id, usageDate: todayDate(), orderId: "", weightProcessed: "", cycleDurationMinutes: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("log_machine_usage", "Saisir l'utilisation")} - {machine?.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="usageDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("usage_date", "Date")}</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-machine-usage-date" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="orderId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("order_id_optional", "Commande (optionnel)")}</FormLabel>
                  <FormControl><Input type="number" {...field} data-testid="input-machine-usage-order" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="weightProcessed" rules={{ required: true }} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("weight_processed_kg", "Poids traité (kg)")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} data-testid="input-machine-usage-weight" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cycleDurationMinutes" rules={{ required: true }} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("cycle_duration_minutes", "Durée du cycle (min)")}</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} data-testid="input-machine-usage-duration" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending || !machine} data-testid="button-save-machine-usage">
              {mutation.isPending ? t("saving") : t("save_machine_usage", "Enregistrer l'utilisation")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MachineDialog({ open, onOpenChange, machine }: { open: boolean; onOpenChange: (v: boolean) => void; machine: Machine | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      name: machine?.name || "",
      type: machine?.type || "washer",
      brand: machine?.brand || "",
      model: machine?.model || "",
      capacityKg: machine?.capacityKg || "0",
      purchaseDate: machine?.purchaseDate ? String(machine.purchaseDate).slice(0, 10) : "",
      status: machine?.status || "active",
      lastMaintenanceDate: machine?.lastMaintenanceDate ? String(machine.lastMaintenanceDate).slice(0, 10) : "",
      maintenanceIntervalDays: machine?.maintenanceIntervalDays || "",
      maintenanceIntervalHours: machine?.maintenanceIntervalHours || "",
      maintenanceCost: machine?.maintenanceCost || "",
    },
  });

  const isEdit = !!machine;

  const { toast } = useToast();
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
    onError: (err: any) => {
      toast({ title: t("error"), description: err?.message || t("error"), variant: "destructive" });
    },
  });

  if (open && machine && form.getValues("name") !== machine.name) {
    form.reset({
      name: machine.name,
      type: machine.type,
      brand: machine.brand || "",
      model: machine.model || "",
      capacityKg: machine.capacityKg,
      purchaseDate: machine.purchaseDate ? String(machine.purchaseDate).slice(0, 10) : "",
      status: machine.status,
      lastMaintenanceDate: machine.lastMaintenanceDate ? String(machine.lastMaintenanceDate).slice(0, 10) : "",
      maintenanceIntervalDays: machine.maintenanceIntervalDays || "",
      maintenanceIntervalHours: machine.maintenanceIntervalHours || "",
      maintenanceCost: machine.maintenanceCost || "",
    });
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
                    <SelectItem value="washer">{t("machine_type_washer")}</SelectItem>
                    <SelectItem value="dryer">{t("machine_type_dryer")}</SelectItem>
                    <SelectItem value="boiler_iron">{t("machine_type_boiler_iron", "Boiler Iron")}</SelectItem>
                    <SelectItem value="press">{t("machine_type_press")}</SelectItem>
                    <SelectItem value="packaging">{t("machine_type_packaging", "Packaging Machine")}</SelectItem>
                    <SelectItem value="other">{t("machine_type_other")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("machine_brand", "Brand")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-machine-brand" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("machine_model", "Model")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-machine-model" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="capacityKg" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("capacity_kg")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-machine-capacity" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("purchase_date", "Purchase Date")}</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-machine-purchase-date" /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("machine_status")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-machine-status"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="active">{t("machine_status_active")}</SelectItem>
                    <SelectItem value="maintenance">{t("machine_status_maintenance")}</SelectItem>
                    <SelectItem value="inactive">{t("machine_status_inactive")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="lastMaintenanceDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("last_maintenance_date", "Last Maintenance Date")}</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-machine-last-maintenance" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="maintenanceCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maintenance_cost", "Maintenance Cost")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-machine-maintenance-cost" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="maintenanceIntervalDays" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maintenance_interval_days", "Maintenance Interval (Days)")}</FormLabel>
                  <FormControl><Input type="number" {...field} data-testid="input-machine-maintenance-days" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="maintenanceIntervalHours" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maintenance_interval_hours", "Maintenance Interval (Hours)")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-machine-maintenance-hours" /></FormControl>
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-machine">
              {mutation.isPending ? t("saving") : isEdit ? t("save_changes") : t("add_machine")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
