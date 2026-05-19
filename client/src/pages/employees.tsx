import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useForm } from "react-hook-form";
import { UserCheck, Plus, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";

export default function Employees() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  if (!hasFeature("employees")) {
    return <UpgradePrompt title={t("employees")} description="Track staff productivity, kg processed and salaries." requiredPlan="Pro" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-employees-title">{t("employees")}</h1>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-lg shadow-primary/25" data-testid="button-add-employee">
          <Plus className="w-4 h-4 mr-2" /> {t("add_employee")}
        </Button>
      </div>

      <EmployeeList onEdit={(e) => { setEditing(e); setOpen(true); }} />

      <EmployeeDialog open={open} onOpenChange={setOpen} employee={editing} />
    </div>
  );
}

function EmployeeList({ onEdit }: { onEdit: (e: Employee) => void }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const queryClient = useQueryClient();
  const { data: employees, isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/employees"] }),
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  if (!employees || employees.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
        <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p data-testid="text-no-employees">{t("no_employees_yet")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {employees.map((emp) => {
        const initial = emp.name.charAt(0).toUpperCase();
        const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];
        const bgColor = colors[emp.id % colors.length];

        return (
          <Card key={emp.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-employee-${emp.id}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-lg">{emp.name}</h3>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">{emp.role}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {emp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{emp.phone}</span>}
                    {emp.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>}
                  </div>
                </div>
                <div className="text-right space-y-1 hidden sm:block">
                  <div className="text-sm"><span className="text-muted-foreground">{t("kg_processed")}:</span> {emp.kgProcessed}</div>
                  <div className="text-sm"><span className="text-muted-foreground">{t("orders_handled")}:</span> {emp.ordersHandled}</div>
                  {emp.salary && <div className="text-sm font-medium">{t("monthly_salary")}: {symbol}{Number(emp.salary).toFixed(0)}</div>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(emp)} data-testid={`button-edit-employee-${emp.id}`}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this employee?")) deleteMutation.mutate(emp.id); }} data-testid={`button-delete-employee-${emp.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EmployeeDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (v: boolean) => void; employee: Employee | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!employee;

  const form = useForm({
    defaultValues: {
      name: employee?.name || "",
      role: employee?.role || "",
      phone: employee?.phone || "",
      email: employee?.email || "",
      salary: employee?.salary || "",
      kgProcessed: employee?.kgProcessed || "0",
      ordersHandled: employee?.ordersHandled || 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) return apiRequest("PATCH", `/api/employees/${employee!.id}`, data);
      return apiRequest("POST", "/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      onOpenChange(false);
      form.reset();
    },
  });

  if (open && employee && form.getValues("name") !== employee.name) {
    form.reset({ name: employee.name, role: employee.role, phone: employee.phone || "", email: employee.email || "", salary: employee.salary || "", kgProcessed: employee.kgProcessed, ordersHandled: employee.ordersHandled });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("edit") : t("add_employee")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField control={form.control} name="name" rules={{ required: true }} render={({ field }) => (
              <FormItem>
                <FormLabel>{t("employee_name")}</FormLabel>
                <FormControl><Input {...field} data-testid="input-employee-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="role" rules={{ required: true }} render={({ field }) => (
              <FormItem>
                <FormLabel>{t("employee_role")}</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Operator" data-testid="input-employee-role" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("phone")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employee-phone" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl><Input type="email" {...field} data-testid="input-employee-email" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="salary" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("monthly_salary")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employee-salary" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="kgProcessed" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("kg_processed")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employee-kg" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="ordersHandled" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("orders_handled")}</FormLabel>
                  <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-employee-orders" /></FormControl>
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-employee">
              {mutation.isPending ? "Saving..." : isEdit ? t("save_changes") : t("add_employee")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
