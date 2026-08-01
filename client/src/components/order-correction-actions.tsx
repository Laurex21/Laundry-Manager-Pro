import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EditableItem = { serviceId: number; quantity: number };
type EditableGarment = { itemName: string; quantity: number };

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to complete order correction");
  return body;
}

export function OrderCorrectionActions({ order, isManager }: { order: any; isManager: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [customerId, setCustomerId] = useState(String(order.customerId || order.customer?.id || ""));
  const [entryDate, setEntryDate] = useState(String(order.entryDate || "").slice(0, 10));
  const [pickupDate, setPickupDate] = useState(String(order.pickupDate || "").slice(0, 10));
  const [reason, setReason] = useState("");
  const [copyReason, setCopyReason] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [garments, setGarments] = useState<EditableGarment[]>([]);

  const { data: eligibility } = useQuery<any>({
    queryKey: ["/api/orders", order.id, "correction-eligibility"],
    queryFn: async () => readJson(await fetch(`/api/orders/${order.id}/correction-eligibility`, { credentials: "include" })),
    enabled: isManager,
  });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/customers"], enabled: editOpen });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ["/api/services"], enabled: editOpen });

  useEffect(() => {
    if (!editOpen) return;
    setCustomerId(String(order.customerId || order.customer?.id || ""));
    setEntryDate(String(order.entryDate || "").slice(0, 10));
    setPickupDate(String(order.pickupDate || "").slice(0, 10));
    setReason("");
    setItems((order.items || []).map((item: any) => ({ serviceId: Number(item.serviceId), quantity: Number(item.quantity) })));
    setGarments((order.garmentItems || []).map((garment: any) => ({ itemName: garment.itemName, quantity: Number(garment.quantity) })));
  }, [editOpen, order]);

  const activeServices = useMemo(() => services.filter((service: any) => service.active !== false), [services]);
  const validEdit = Number(customerId) > 0
    && entryDate
    && reason.trim().length >= 5
    && items.length > 0
    && items.every((item) => item.serviceId > 0 && item.quantity > 0)
    && garments.every((garment) => garment.itemName.trim() && garment.quantity > 0);

  const editMutation = useMutation({
    mutationFn: async () => readJson(await fetch(`/api/orders/${order.id}/correct`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: Number(customerId),
        entryDate: new Date(`${entryDate}T00:00:00`).toISOString(),
        pickupDate: pickupDate ? new Date(`${pickupDate}T00:00:00`).toISOString() : null,
        reason: reason.trim(),
        items,
        garments: garments.map((garment) => ({ ...garment, itemName: garment.itemName.trim() })),
      }),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", order.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order.id, "correction-eligibility"] });
      setEditOpen(false);
      toast({ title: t("order_correction_saved") });
    },
    onError: (error: Error) => toast({ title: t("order_correction_failed"), description: error.message, variant: "destructive" }),
  });

  const copyMutation = useMutation({
    mutationFn: async () => readJson(await fetch(`/api/orders/${order.id}/corrected-copy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: copyReason.trim() }),
    })),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", order.id] });
      setCopyOpen(false);
      toast({ title: t("corrected_order_created") });
      navigate(`/orders/${result.orderId}`);
    },
    onError: (error: Error) => toast({ title: t("order_correction_failed"), description: error.message, variant: "destructive" }),
  });

  if (!isManager) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid="order-correction-actions">
        {eligibility?.canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-correct-order">
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("correct_order")}
          </Button>
        )}
        {!eligibility?.canEdit && eligibility?.canCreateCorrectedCopy && (
          <Button type="button" variant="outline" size="sm" onClick={() => { setCopyReason(""); setCopyOpen(true); }} data-testid="button-create-corrected-copy">
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("create_corrected_order")}
          </Button>
        )}
        {eligibility?.reason === "financial_impact" && (
          <p className="max-w-md text-xs text-muted-foreground" role="note">
            <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t("paid_order_correction_locked")}
          </p>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("correct_order")} #{order.id}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (validEdit) editMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="correction-customer">{t("customers")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="correction-customer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {customers.map((customer: any) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name} · {customer.phone}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="correction-entry-date">{t("date_of_entry")}</Label>
                <Input id="correction-entry-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correction-pickup-date">{t("pickup_date")}</Label>
                <Input id="correction-pickup-date" type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
              </div>
            </div>

            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-semibold">{t("services")}</legend>
              {items.map((item, index) => (
                <div key={`${index}-${item.serviceId}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`correction-service-${index}`}>{t("services")}</Label>
                    <Select value={String(item.serviceId || "")} onValueChange={(value) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, serviceId: Number(value) } : entry))}>
                      <SelectTrigger id={`correction-service-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeServices.map((service: any) => <SelectItem key={service.id} value={String(service.id)}>{service.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`correction-quantity-${index}`}>{t("quantity")}</Label>
                    <Input id={`correction-quantity-${index}`} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={t("remove")}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, { serviceId: activeServices[0]?.id || 0, quantity: 1 }])}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />{t("add_service")}
              </Button>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-semibold">{t("garments")}</legend>
              {garments.map((garment, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`correction-garment-${index}`}>{t("garment_type")}</Label>
                    <Input id={`correction-garment-${index}`} value={garment.itemName} onChange={(event) => setGarments((current) => current.map((entry, garmentIndex) => garmentIndex === index ? { ...entry, itemName: event.target.value } : entry))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`correction-garment-quantity-${index}`}>{t("quantity")}</Label>
                    <Input id={`correction-garment-quantity-${index}`} type="number" min="1" value={garment.quantity} onChange={(event) => setGarments((current) => current.map((entry, garmentIndex) => garmentIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive" onClick={() => setGarments((current) => current.filter((_, garmentIndex) => garmentIndex !== index))} aria-label={t("remove")}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setGarments((current) => [...current, { itemName: "", quantity: 1 }])}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />{t("add_garment")}
              </Button>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="correction-reason">{t("correction_reason")}</Label>
              <Textarea id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} required />
              <p className="text-xs text-muted-foreground">{t("correction_audit_notice")}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={!validEdit || editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("save_correction")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("create_corrected_order")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("corrected_copy_explanation")}</p>
            <div className="space-y-2">
              <Label htmlFor="corrected-copy-reason">{t("correction_reason")}</Label>
              <Textarea id="corrected-copy-reason" value={copyReason} onChange={(event) => setCopyReason(event.target.value)} minLength={5} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCopyOpen(false)}>{t("cancel")}</Button>
            <Button type="button" onClick={() => copyMutation.mutate()} disabled={copyReason.trim().length < 5 || copyMutation.isPending}>
              {copyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("create_corrected_order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
