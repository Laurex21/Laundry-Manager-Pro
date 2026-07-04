import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useForm } from "react-hook-form";
import { UserCheck, Plus, Pencil, Trash2, Phone, Mail, IdCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import type { Employee } from "@shared/schema";

export default function Employees() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<Employee | null>(null);

  if (!hasFeature("employees")) {
    return <UpgradePrompt title={t("employees")} description="Track staff productivity, kg processed and salaries." requiredPlan="Pro" />;
  }

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-employees-title">{t("employees")}</h1>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-lg shadow-primary/25" data-testid="button-add-employee">
          <Plus className="w-4 h-4 mr-2" /> {t("add_employee")}
        </Button>
      </div>

      <EmployeeList onEdit={(e) => { setEditing(e); setOpen(true); }} onDelete={setDeleteTarget} onAttendance={setAttendanceTarget} />

      <EmployeeDialog open={open} onOpenChange={setOpen} employee={editing} />
      <AttendanceDialog
        open={!!attendanceTarget}
        onOpenChange={(v) => { if (!v) setAttendanceTarget(null); }}
        employee={attendanceTarget}
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
            <DeleteEmployeeAction employee={deleteTarget} onDone={() => setDeleteTarget(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteEmployeeAction({ employee, onDone }: { employee: Employee | null; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/employees"] }); onDone(); },
  });

  return (
    <AlertDialogAction
      className="bg-destructive text-destructive-foreground"
      disabled={deleteMutation.isPending}
      onClick={() => employee && deleteMutation.mutate(employee.id)}
    >
      {deleteMutation.isPending ? t("deleting") : t("delete")}
    </AlertDialogAction>
  );
}

const AVATAR_COLORS = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];

function EmployeeList({ onEdit, onDelete, onAttendance }: { onEdit: (e: Employee) => void; onDelete: (e: Employee) => void; onAttendance: (e: Employee) => void }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data: employees, isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}</div>;
  }

  if (!employees || employees.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
        <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm" data-testid="text-no-employees">{t("no_employees_yet")}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden divide-y divide-border bg-card">
      <div className="hidden xl:grid grid-cols-[minmax(190px,1.6fr)_minmax(130px,1fr)_minmax(220px,1.6fr)_minmax(96px,.7fr)_minmax(120px,.8fr)_minmax(130px,.8fr)_104px] gap-4 px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{t("employee_name")}</span>
        <span>{t("employee_position", "Position")}</span>
        <span>{t("phone")} / {t("email")}</span>
        <span>{t("kg_processed")}</span>
        <span>{t("orders_handled")}</span>
        <span>{t("monthly_salary")}</span>
        <span></span>
      </div>
      {employees.map((emp) => {
        const initial = emp.name.charAt(0).toUpperCase();
        const bgColor = AVATAR_COLORS[emp.id % AVATAR_COLORS.length];

        return (
          <div key={emp.id} className="grid grid-cols-1 gap-4 px-4 py-4 hover:bg-muted/20 transition-colors xl:grid-cols-[minmax(190px,1.6fr)_minmax(130px,1fr)_minmax(220px,1.6fr)_minmax(96px,.7fr)_minmax(120px,.8fr)_minmax(130px,.8fr)_104px] xl:gap-x-4 xl:gap-y-1 xl:items-center xl:py-3" data-testid={`card-employee-${emp.id}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-7 h-7 ${bgColor} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {initial}
              </div>
              <div className="min-w-0">
                <span className="block font-medium text-sm truncate">{emp.name}</span>
                <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                  {t("employee_name")}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-start">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                {t("employee_position", "Position")}
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit">{emp.position || emp.role}</span>
              <Badge variant={emp.status === "inactive" ? "outline" : "default"} className="text-[10px]">{t(`employee_status_${emp.status}`, emp.status)}</Badge>
            </div>
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground min-w-0">
              <span className="mb-0.5 font-semibold uppercase tracking-wide xl:hidden">
                {t("phone")} / {t("email")}
              </span>
              {emp.employeeCode && (
                <span className="flex items-center gap-1 truncate">
                  <IdCard className="w-3 h-3 shrink-0" />{emp.employeeCode}
                </span>
              )}
              {emp.phone && (
                <span className="flex items-center gap-1 truncate">
                  <Phone className="w-3 h-3 shrink-0" />{emp.phone}
                </span>
              )}
              {emp.email && (
                <span className="flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 shrink-0" />{emp.email}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/35 p-3 xl:contents">
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">{t("kg_processed")}</span>
                <span className="text-sm font-mono">{emp.kgProcessed}</span>
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">{t("orders_handled")}</span>
                <span className="text-sm font-mono">{emp.ordersHandled}</span>
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">{t("monthly_salary")}</span>
                <span className="text-sm font-medium">
                  {emp.salary ? `${symbol}${Number(emp.salary).toFixed(0)}` : "-"}
                </span>
              </div>
            </div>
            <div className="flex gap-1 justify-end border-t pt-3 xl:border-t-0 xl:pt-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 xl:h-7 xl:w-7" onClick={() => onAttendance(emp)} title={t("attendance", "Pointage")} aria-label={`${t("attendance", "Pointage")} - ${emp.name}`} data-testid={`button-attendance-employee-${emp.id}`}>
                <Clock className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 xl:h-7 xl:w-7" onClick={() => onEdit(emp)} aria-label={`${t("edit", "Edit")} - ${emp.name}`} data-testid={`button-edit-employee-${emp.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 xl:h-7 xl:w-7 text-destructive" onClick={() => onDelete(emp)} aria-label={`${t("delete", "Delete")} - ${emp.name}`} data-testid={`button-delete-employee-${emp.id}`}>
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

function AttendanceDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (v: boolean) => void; employee: Employee | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      employeeId: employee?.id || 0,
      workDate: todayDate(),
      status: "present",
      checkInAt: "",
      checkOutAt: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/employees/${employee!.id}/attendance`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/advanced"] });
      onOpenChange(false);
      form.reset({ employeeId: employee?.id || 0, workDate: todayDate(), status: "present", checkInAt: "", checkOutAt: "" });
    },
  });

  if (open && employee && form.getValues("employeeId") !== employee.id) {
    form.reset({ employeeId: employee.id, workDate: todayDate(), status: "present", checkInAt: "", checkOutAt: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("attendance_for_employee", "Pointage")} - {employee?.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="workDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("work_date", "Date")}</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-attendance-date" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("status")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-attendance-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="present">{t("attendance_present", "Présent")}</SelectItem>
                      <SelectItem value="late">{t("attendance_late", "En retard")}</SelectItem>
                      <SelectItem value="absent">{t("attendance_absent", "Absent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="checkInAt" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("check_in_time", "Heure d'arrivée")}</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} data-testid="input-check-in" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="checkOutAt" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("check_out_time", "Heure de départ")}</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} data-testid="input-check-out" /></FormControl>
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending || !employee} data-testid="button-save-attendance">
              {mutation.isPending ? t("saving") : t("save_attendance", "Enregistrer le pointage")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (v: boolean) => void; employee: Employee | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!employee;

  const form = useForm({
    defaultValues: {
      name: employee?.name || "",
      photoUrl: employee?.photoUrl || "",
      employeeCode: employee?.employeeCode || "",
      role: employee?.role || "",
      position: employee?.position || employee?.role || "",
      phone: employee?.phone || "",
      email: employee?.email || "",
      salary: employee?.salary || "",
      dateHired: employee?.dateHired ? String(employee.dateHired).slice(0, 10) : "",
      status: employee?.status || "active",
      kgProcessed: employee?.kgProcessed || "0",
      ordersHandled: employee?.ordersHandled || 0,
    },
  });

  const { toast } = useToast();
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
    onError: (err: any) => {
      toast({ title: t("error"), description: err?.message || t("error"), variant: "destructive" });
    },
  });

  if (open && employee && form.getValues("name") !== employee.name) {
    form.reset({
      name: employee.name,
      photoUrl: employee.photoUrl || "",
      employeeCode: employee.employeeCode || "",
      role: employee.role,
      position: employee.position || employee.role,
      phone: employee.phone || "",
      email: employee.email || "",
      salary: employee.salary || "",
      dateHired: employee.dateHired ? String(employee.dateHired).slice(0, 10) : "",
      status: employee.status || "active",
      kgProcessed: employee.kgProcessed,
      ordersHandled: employee.ordersHandled,
    });
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
                <FormLabel>{t("employee_full_name", "Full Name")}</FormLabel>
                <FormControl><Input {...field} data-testid="input-employee-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="employeeCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("employee_id", "Employee ID")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employee-code" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="photoUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("employee_photo", "Photo")}</FormLabel>
                  <FormControl><Input {...field} placeholder="https://..." data-testid="input-employee-photo" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="role" rules={{ required: true }} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("employee_role")}</FormLabel>
                  <FormControl><Input {...field} placeholder={t("role_placeholder")} data-testid="input-employee-role" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("employee_position", "Job Position")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employee-position" /></FormControl>
                </FormItem>
              )} />
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-employee-orders" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="dateHired" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("date_hired", "Date Hired")}</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-employee-date-hired" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("status")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-employee-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t("employee_status_active", "Active")}</SelectItem>
                      <SelectItem value="inactive">{t("employee_status_inactive", "Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-employee">
              {mutation.isPending ? t("saving") : isEdit ? t("save_changes") : t("add_employee")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
