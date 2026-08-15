import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, MoreHorizontal, Plus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import SubscriptionDashboardPage from "@/pages/subscription-dashboard";

type Plan = Record<string, any> & { id: number; name: string; recurringPrice: string; billingCycle: string; status: string; subscriberCount: number; services: { id: number; name: string }[] };
const empty = { name: "", description: "", status: "active", billingCycle: "monthly", durationDays: 30, recurringPrice: "", activationFee: "0", includedWeightKg: "", includedPieces: "", maxOrders: "", allowCarryForward: false, carryForwardLimit: "", overagePricePerKg: "", overagePricePerPiece: "", pickupIncluded: false, deliveryIncluded: false, expressIncluded: false, priorityQueue: false, discountPercentage: "0", autoRenew: true, gracePeriodDays: 3, renewalReminderDays: 7, cancellationPolicy: "", serviceIds: [] as number[] };
const optionalPositiveKeys = ["includedWeightKg", "includedPieces", "maxOrders"] as const;
const optionalPositiveInput = (value: unknown) => value == null || value === "" || Number(value) === 0 ? "" : value;
const optionalPositiveNumber = (value: unknown) => value == null || value === "" || Number(value) === 0 ? null : Number(value);

export default function MembershipPlansPage() {
  const { t } = useTranslation(); const { toast } = useToast(); const [, navigate] = useLocation(); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<Plan | null>(null); const [form, setForm] = useState<any>(empty); const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null); const [pendingAction, setPendingAction] = useState<{ plan: Plan; type: "archive" | "delete" } | null>(null);
  const viewParam = new URLSearchParams(useSearch()).get("view");
  const view = viewParam === "subscribers" || viewParam === "revenue" ? viewParam : "plans";
  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ["/api/subscription-plans"] });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ["/api/services"] });
  function friendlyError(e: Error) {
    try {
      const body = JSON.parse(e.message.replace(/^\d+:\s*/, ""));
      if (body?.message) return { field: body.field ? String(body.field) : undefined, message: String(body.message) };
    } catch { /* ignore */ }
    return { message: e.message };
  }
  const mutation = useMutation({ mutationFn: async () => {
    const payload = { ...form, recurringPrice: Number(form.recurringPrice), activationFee: Number(form.activationFee || 0), includedWeightKg: optionalPositiveNumber(form.includedWeightKg), includedPieces: optionalPositiveNumber(form.includedPieces), maxOrders: optionalPositiveNumber(form.maxOrders), carryForwardLimit: form.carryForwardLimit === "" ? null : Number(form.carryForwardLimit), overagePricePerKg: form.overagePricePerKg === "" ? null : Number(form.overagePricePerKg), overagePricePerPiece: form.overagePricePerPiece === "" ? null : Number(form.overagePricePerPiece) };
    return apiRequest(editing ? "PUT" : "POST", editing ? `/api/subscription-plans/${editing.id}` : "/api/subscription-plans", payload);
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] }); setFieldError(null); setOpen(false); toast({ title: editing ? "Plan updated" : "Plan created" }); }, onError: (e: Error) => { const error = friendlyError(e); setFieldError(error); toast({ title: "Could not save plan", description: error.field ? `${error.field}: ${error.message}` : error.message, variant: "destructive" }); } });
  const duplicate = useMutation({ mutationFn: (id: number) => apiRequest("POST", `/api/subscription-plans/${id}/duplicate`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] }) });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: number; status: "active" | "archived" }) => apiRequest("PATCH", `/api/subscription-plans/${id}/status`, { status }), onSuccess: (_, variables) => { queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] }); setPendingAction(null); toast({ title: variables.status === "active" ? "Plan restored" : "Plan archived" }); }, onError: (e: Error) => toast({ title: "Could not update plan", description: e.message, variant: "destructive" }) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/subscription-plans/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] }); setPendingAction(null); toast({ title: "Plan deleted" }); }, onError: (e: Error) => toast({ title: "Could not delete plan", description: e.message, variant: "destructive" }) });
  const revenue = useMemo(() => plans.filter(p => p.status === "active").reduce((n, p) => n + Number(p.recurringPrice) * Number(p.subscriberCount || 0), 0), [plans]);
  const edit = (plan?: Plan) => {
    setEditing(plan ?? null);
    setFieldError(null);
    setForm(plan ? {
      ...empty,
      ...plan,
      ...Object.fromEntries(optionalPositiveKeys.map((key) => [key, optionalPositiveInput(plan[key])])),
      serviceIds: plan.services.map(s => s.id),
    } : empty);
    setOpen(true);
  };
  const field = (key: string, label: string, type = "text", extras: Record<string, any> = {}) => {
    const invalid = fieldError?.field === key;
    return <div className="space-y-1.5"><Label htmlFor={`plan-${key}`}>{label}</Label><Input id={`plan-${key}`} type={type} value={form[key] ?? ""} aria-invalid={invalid || undefined} aria-describedby={invalid ? `plan-${key}-error` : undefined} onChange={e => { setForm({ ...form, [key]: e.target.value }); if (invalid) setFieldError(null); }} {...extras} />{invalid && <p id={`plan-${key}-error`} role="alert" className="text-xs text-destructive">{fieldError.message}</p>}</div>;
  };
  const toggle = (key: string, label: string) => <div className="flex items-center justify-between rounded-lg border p-3"><Label>{label}</Label><Switch checked={!!form[key]} onCheckedChange={v => setForm({ ...form, [key]: v })} /></div>;
  return <div className="space-y-6 page-fade-in">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">{view === "plans" ? t("subscription_plans") : view === "subscribers" ? "Subscribers" : "Subscription revenue"}</h1><p className="text-sm text-muted-foreground">{view === "plans" ? "Configurez les offres membres de votre organisation." : view === "subscribers" ? "Customer plans, usage and current-cycle payment position." : "Recurring revenue, payments and subscription performance."}</p></div>{view === "plans" && <Button onClick={() => edit()}><Plus className="mr-2 h-4 w-4" />{t("new_plan")}</Button>}</div>
    {/* Radix Tabs supplies the WCAG keyboard model; URL navigation keeps each view refreshable and shareable. */}
    <Tabs value={view} onValueChange={(value) => navigate(value === "plans" ? "/membership-plans" : `/membership-plans?view=${value}`)}><TabsList aria-label="Subscription management views"><TabsTrigger value="plans">Plans</TabsTrigger><TabsTrigger value="subscribers">Subscribers</TabsTrigger><TabsTrigger value="revenue">Revenue</TabsTrigger></TabsList></Tabs>
    {view === "plans" ? <>
    <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Plans actifs</p><p className="text-2xl font-bold">{plans.filter(p=>p.status==="active").length}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("active_subscribers")}</p><p className="text-2xl font-bold">{plans.reduce((n,p)=>n+Number(p.subscriberCount||0),0)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("monthly_revenue")}</p><p className="text-2xl font-bold">{revenue.toLocaleString()} FCFA</p></CardContent></Card></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map(plan => <Card key={plan.id} className="overflow-hidden"><CardHeader className="pb-3"><div className="flex items-start justify-between"><div><CardTitle>{plan.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{Number(plan.recurringPrice).toLocaleString()} FCFA / {t(plan.billingCycle)}</p></div><Badge variant={plan.status === "active" ? "default" : "secondary"}>{plan.status}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{plan.subscriberCount} {t("active_subscribers").toLowerCase()}</div><div className="flex flex-wrap gap-1">{plan.services.map(s=><Badge key={s.id} variant="outline">{s.name}</Badge>)}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>edit(plan)}>Edit</Button><Button size="sm" variant="outline" aria-label={`Duplicate ${plan.name}`} onClick={()=>duplicate.mutate(plan.id)}><Copy className="h-4 w-4" aria-hidden="true" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label={`Actions for ${plan.name}`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{plan.subscriberCount > 0 ? "Move active subscribers before archiving or deleting" : "Plan actions"}</DropdownMenuLabel>{plan.status === "archived" ? <DropdownMenuItem onClick={()=>statusMutation.mutate({ id: plan.id, status: "active" })}>Restore to active</DropdownMenuItem> : <DropdownMenuItem disabled={plan.subscriberCount > 0} onClick={()=>setPendingAction({ plan, type: "archive" })}>Archive plan</DropdownMenuItem>}<DropdownMenuItem className="text-destructive focus:text-destructive" disabled={plan.subscriberCount > 0} onClick={()=>setPendingAction({ plan, type: "delete" })}>Delete plan</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></CardContent></Card>)}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit Plan" : t("new_plan")}</DialogTitle></DialogHeader><form className="space-y-6" onSubmit={e=>{e.preventDefault(); mutation.mutate();}}>
      <section className="grid gap-4 sm:grid-cols-2"><h3 className="sm:col-span-2 font-semibold">1. General</h3>{field("name",t("plan_name"))}<div className="sm:col-span-2 space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div></section>
      <section className="grid gap-4 sm:grid-cols-3"><h3 className="sm:col-span-3 font-semibold">2. Pricing</h3>{field("recurringPrice",t("recurring_price"),"number")}<div className="space-y-1.5"><Label>{t("billing_cycle")}</Label><Select value={form.billingCycle} onValueChange={v=>setForm({...form,billingCycle:v,durationDays:{weekly:7,monthly:30,quarterly:90,annual:365}[v]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["weekly","monthly","quarterly","annual"].map(v=><SelectItem key={v} value={v}>{t(v)}</SelectItem>)}</SelectContent></Select></div>{field("durationDays","Duration (days)","number")}{field("activationFee",t("activation_fee"),"number")}</section>
      <section className="grid gap-4 sm:grid-cols-3"><h3 className="sm:col-span-3 font-semibold">3. Usage Limits</h3>{field("includedWeightKg",t("included_weight"),"number")}{field("includedPieces",t("included_pieces"),"number")}{field("maxOrders",t("max_orders"),"number")}</section>
      <section className="space-y-3"><h3 className="font-semibold">4. Included Services</h3><div className="grid sm:grid-cols-2">{services.map(s=><label key={s.id} className="flex items-center gap-2 p-2"><Checkbox checked={form.serviceIds.includes(s.id)} onCheckedChange={v=>setForm({...form,serviceIds:v?[...form.serviceIds,s.id]:form.serviceIds.filter((id:number)=>id!==s.id)})}/>{s.name}</label>)}</div></section>
      <section className="grid gap-3 sm:grid-cols-2"><h3 className="sm:col-span-2 font-semibold">5. Benefits</h3>{toggle("pickupIncluded",t("pickup_included"))}{toggle("deliveryIncluded",t("delivery_included"))}{toggle("expressIncluded",t("express_included"))}{toggle("priorityQueue",t("priority_queue"))}{field("discountPercentage","Discount % (0–100)","number",{min:0,max:100,step:"0.01"})}</section>
      <section className="grid gap-4 sm:grid-cols-2"><h3 className="sm:col-span-2 font-semibold">6. Overage Rules</h3>{toggle("allowCarryForward",t("carry_forward"))}{field("carryForwardLimit","Carry Forward Limit","number")}{field("overagePricePerKg",t("overage_price_kg"),"number")}{field("overagePricePerPiece",t("overage_price_piece"),"number")}</section>
      <section className="grid gap-4 sm:grid-cols-2"><h3 className="sm:col-span-2 font-semibold">7. Renewal Settings</h3>{toggle("autoRenew",t("auto_renew"))}{field("gracePeriodDays",t("grace_period"),"number")}{field("renewalReminderDays",t("renewal_reminder"),"number")}<div className="sm:col-span-2 space-y-1.5"><Label>Cancellation Policy</Label><Textarea value={form.cancellationPolicy} onChange={e=>setForm({...form,cancellationPolicy:e.target.value})}/></div></section>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!form.name || !Number(form.recurringPrice) || mutation.isPending}>Save Plan</Button></div>
    </form></DialogContent></Dialog>
    <AlertDialog open={!!pendingAction} onOpenChange={(value)=>{ if (!value) setPendingAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pendingAction?.type === "delete" ? "Delete plan?" : "Archive plan?"}</AlertDialogTitle><AlertDialogDescription>{pendingAction?.type === "delete" ? `Delete ${pendingAction?.plan.name} from the available plans? Existing historical records will be preserved.` : `Archive ${pendingAction?.plan.name}? You can restore it later from this page.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className={pendingAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} disabled={statusMutation.isPending || deleteMutation.isPending} onClick={()=>{ if (!pendingAction) return; if (pendingAction.type === "delete") deleteMutation.mutate(pendingAction.plan.id); else statusMutation.mutate({ id: pendingAction.plan.id, status: "archived" }); }}>{pendingAction?.type === "delete" ? "Delete plan" : "Archive plan"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </> : <SubscriptionDashboardPage embedded viewOverride={view} />}
  </div>;
}
