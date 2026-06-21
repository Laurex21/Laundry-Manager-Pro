import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomerSchema, type InsertCustomer, type Customer } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import {
  Pen,
  Crown,
  ShoppingBag,
  Wallet,
  AlertCircle,
  MapPin,
  Phone,
  MessageCircle,
  ArrowLeft,
  ExternalLink,
  Save,
  X,
  Truck,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VIP_THRESHOLD = 50000;

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

function useCustomerOrders(customerId: number) {
  return useQuery({
    queryKey: ["/api/customers", customerId, "orders"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/orders`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customer orders");
      return res.json();
    },
    enabled: !!customerId,
  });
}

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const customerId = Number(params.id);
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId);
  const { data: customerOrders, isLoading: ordersLoading } = useCustomerOrders(customerId);
  const [editOpen, setEditOpen] = useState(false);

  if (customerLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="text-lg font-medium">{t("customer_not_found")}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/customers")} data-testid="button-back-customers">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("back_to_customers")}
        </Button>
      </div>
    );
  }

  const orders = customerOrders || [];
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
  const outstandingBalance = orders.reduce((sum: number, o: any) => sum + Number(o.balance || 0), 0);
  const isVIP = totalSpent >= VIP_THRESHOLD;
  const hasNotes = !!customer.notes && customer.notes.trim().length > 0;

  const whatsappLink = `https://wa.me/${customer.phone.replace(/[^0-9+]/g, "")}`;
  const callLink = `tel:${customer.phone}`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    unpaid: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const orderStatusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    delivered: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted-foreground">{t("customers")}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-muted bg-muted">
            <AvatarFallback className="font-bold text-primary text-2xl">
              {customer.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold" data-testid="text-customer-name">{customer.name}</h1>
              {isVIP && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate" data-testid="badge-vip">
                  <Crown className="w-3 h-3 mr-1" /> VIP
                </Badge>
              )}
              {hasNotes && (
                <Pen className="w-4 h-4 text-muted-foreground" data-testid="icon-has-notes" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-customer-phone">
              <Phone className="w-3.5 h-3.5 inline mr-1" />{customer.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/orders")} size="sm" data-testid="button-new-order">
            <ShoppingBag className="w-4 h-4 mr-1.5" /> {t("new_order")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-profile">
            <Pen className="w-4 h-4 mr-1.5" /> {t("edit_profile")}
          </Button>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" data-testid="button-whatsapp">
              <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
            </Button>
          </a>
          <a href={callLink}>
            <Button variant="outline" size="sm" data-testid="button-call">
              <Phone className="w-4 h-4 mr-1.5" /> {t("call")}
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-total-orders">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("total_orders")}</p>
                <p className="text-2xl font-bold" data-testid="text-total-orders">{ordersLoading ? "..." : totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-spent">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("total_spent")}</p>
                <p className="text-2xl font-bold" data-testid="text-total-spent">
                  {ordersLoading ? "..." : `${symbol}${totalSpent.toFixed(2)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-outstanding-balance">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("outstanding_balance")}</p>
                <p className="text-2xl font-bold" data-testid="text-outstanding-balance">
                  {ordersLoading ? "..." : `${symbol}${outstandingBalance.toFixed(2)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Punctuality Card */}
      {customer.totalDeliveries > 0 && (
        <Card data-testid="card-punctuality">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              {t("delivery_punctuality")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-total-deliveries">{customer.totalDeliveries}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("total")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-on-time-deliveries">{customer.onTimeDeliveries}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("on_time")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-late-deliveries">{customer.lateDeliveries}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("late")}</p>
              </div>
            </div>

            {/* Progress bar */}
            {(() => {
              const pct = Math.round((customer.onTimeDeliveries / customer.totalDeliveries) * 100);
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {t("on_time_rate")}</span>
                    <span className="font-semibold text-foreground" data-testid="text-on-time-rate">{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                      data-testid="bar-on-time-rate"
                    />
                  </div>
                  <p className={`text-xs font-medium ${pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    {pct >= 80 ? t("excellent_punctuality") : pct >= 50 ? t("room_for_improvement") : t("frequent_late_deliveries")}
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="contact" className="w-full">
        <TabsList className="w-full sm:w-auto" data-testid="tabs-list">
          <TabsTrigger value="contact" data-testid="tab-contact">{t("contact_info")}</TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">{t("preferences")}</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">{t("order_history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="contact">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("address")}</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm" data-testid="text-address">{customer.address}</p>
                  </div>
                </div>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="mt-2" data-testid="button-view-maps">
                    <ExternalLink className="w-4 h-4 mr-2" /> {t("view_on_maps")}
                  </Button>
                </a>
              </div>
              {customer.email && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("email")}</p>
                  <p className="text-sm" data-testid="text-email">{customer.email}</p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("phone")}</p>
                  <p className="text-sm" data-testid="text-phone-detail">{customer.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab customer={customer} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>{t("no_orders_yet")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-order-history">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">{t("order_id")}</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">{t("date")}</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">{t("amount")}</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">{t("status")}</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">{t("payment")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order: any) => (
                        <tr key={order.id} className="border-b last:border-0 hover-elevate" data-testid={`row-order-${order.id}`}>
                          <td className="p-3 font-medium" data-testid={`text-order-id-${order.id}`}>#{order.orderNumber ?? order.id}</td>
                          <td className="p-3 text-muted-foreground">
                            {order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy", { locale: dateLocaleFor(i18n.language) }) : "-"}
                          </td>
                          <td className="p-3 text-right font-medium">{symbol}{Number(order.totalAmount).toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${orderStatusColors[order.status] || ""}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[order.paymentStatus] || ""}`}>
                              {order.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("edit_profile")}</DialogTitle>
          </DialogHeader>
          <EditCustomerForm customer={customer} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreferencesTab({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const { mutate, isPending } = useUpdateCustomer();
  const [starchLevel, setStarchLevel] = useState(customer.starchLevel || "");
  const [detergentType, setDetergentType] = useState(customer.detergentType || "");
  const [notes, setNotes] = useState(customer.notes || "");
  const [dirty, setDirty] = useState(false);

  function handleSave() {
    mutate({
      id: customer.id,
      starchLevel: starchLevel || undefined,
      detergentType: detergentType || undefined,
      notes: notes || undefined,
    }, {
      onSuccess: () => setDirty(false),
    });
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("starch_level")}</label>
            <Select
              value={starchLevel}
              onValueChange={(v) => { setStarchLevel(v); setDirty(true); }}
            >
              <SelectTrigger data-testid="select-starch-level">
                <SelectValue placeholder={t("select_starch_level")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("starch_none")}</SelectItem>
                <SelectItem value="light">{t("starch_light")}</SelectItem>
                <SelectItem value="medium">{t("starch_medium")}</SelectItem>
                <SelectItem value="heavy">{t("starch_heavy")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("detergent_type")}</label>
            <Select
              value={detergentType}
              onValueChange={(v) => { setDetergentType(v); setDirty(true); }}
            >
              <SelectTrigger data-testid="select-detergent-type">
                <SelectValue placeholder={t("select_detergent_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">{t("detergent_regular")}</SelectItem>
                <SelectItem value="hypoallergenic">{t("detergent_hypoallergenic")}</SelectItem>
                <SelectItem value="fragrance_free">{t("detergent_fragrance_free")}</SelectItem>
                <SelectItem value="eco_friendly">{t("detergent_eco_friendly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("special_notes")}</label>
          <Textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
            placeholder={t("special_notes_placeholder")}
            rows={4}
            data-testid="textarea-special-notes"
          />
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={isPending} data-testid="button-save-preferences">
              <Save className="w-4 h-4 mr-2" /> {isPending ? t("saving") : t("save_preferences")}
            </Button>
            <Button variant="ghost" onClick={() => {
              setStarchLevel(customer.starchLevel || "");
              setDetergentType(customer.detergentType || "");
              setNotes(customer.notes || "");
              setDirty(false);
            }} data-testid="button-cancel-preferences">
              <X className="w-4 h-4 mr-2" /> {t("cancel")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditCustomerForm({ customer, onSuccess }: { customer: Customer; onSuccess: () => void }) {
  const { mutate, isPending } = useUpdateCustomer();
  const { t } = useTranslation();

  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address,
      notes: customer.notes || "",
      defaultDiscountPct: customer.defaultDiscountPct ?? "0",
    },
  });

  function onSubmit(data: InsertCustomer) {
    mutate({ id: customer.id, ...data }, {
      onSuccess: () => {
        onSuccess();
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("full_name")}</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-edit-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("phone")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-edit-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-edit-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("address")}</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-edit-address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("notes")}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} data-testid="input-edit-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultDiscountPct"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("default_discount_pct")}</FormLabel>
              <FormControl>
                <Input type="number" step="0.5" min="0" max="100" placeholder="0" {...field} value={field.value?.toString() || "0"} data-testid="input-edit-discount" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-edit">
          {isPending ? t("saving") : t("save_changes")}
        </Button>
      </form>
    </Form>
  );
}
