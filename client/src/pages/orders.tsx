import { useState, useMemo, useEffect } from "react";
import { useOrders, useCreateOrder } from "@/hooks/use-orders";
import { useCustomers, useCreateCustomer } from "@/hooks/use-customers";
import { useServices } from "@/hooks/use-services";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrderWithItemsSchema } from "@shared/routes";
import { insertCustomerSchema, type Service } from "@shared/schema";
import { z } from "zod";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { downloadReceiptHtml, generateDepositReceipt } from "@/lib/receipt";
import { useQuery, useQuery as useSettingsQuery } from "@tanstack/react-query";
import { DEFAULT_SETTINGS } from "@/lib/receipt-settings";
import { orderDisplayId } from "@/lib/order-display";
import {
  Plus,
  Search,
  Trash2,
  ChevronRight,
  UserPlus,
  Check,
  Shirt,
  AlertTriangle,
  PackageOpen,
  MessageCircle,
  Eye,
  Star,
  CalendarDays,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useWhatsAppLauncher } from "@/components/whatsapp-launcher";
import { useToast } from "@/hooks/use-toast";

type CreateOrderFormValues = z.infer<typeof createOrderWithItemsSchema>;

const ACTIVE_STATUSES = new Set(["pending", "received", "sorting", "washing", "drying", "ironing", "packaging", "stain_treatment"]);
const PIPELINE_STATUSES = new Set(["received", "washing", "ready", "delivered"]);
type OrderStatusFilter = "all" | "active" | "ready" | "unpaid" | "received" | "washing" | "delivered";
type OrderPeriodFilter = "all" | "today" | "week" | "month";

function dashboardOrderFilters(): { status: OrderStatusFilter; period: OrderPeriodFilter } {
  const params = new URLSearchParams(window.location.search);
  const statusParam = params.get("status") || "all";
  const periodParam = params.get("period") || "all";
  const status: OrderStatusFilter =
    statusParam === "active" || statusParam === "unpaid" || PIPELINE_STATUSES.has(statusParam)
      ? statusParam as OrderStatusFilter
      : "all";
  const period: OrderPeriodFilter =
    periodParam === "today" || periodParam === "week" || periodParam === "month"
      ? periodParam
      : "all";
  return { status, period };
}

function normalizeWhatsAppPhone(phone?: string | null): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("237")) return digits;
  if (digits.startsWith("6")) return `237${digits}`;
  return digits;
}

function normalizeServiceSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function ServiceCombobox({
  services,
  value,
  onChange,
  symbol,
}: {
  services: Service[];
  value: number;
  onChange: (serviceId: number) => void;
  symbol: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectedService = services.find((service) => service.id === value);
  const groupedServices = useMemo(() => {
    const groups = new Map<string, Service[]>();

    services.forEach((service) => {
      const category = service.category?.trim() || t("uncategorized");
      const categoryServices = groups.get(category) || [];
      categoryServices.push(service);
      groups.set(category, categoryServices);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services, t]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal",
              !selectedService && "text-muted-foreground"
            )}
          >
            <span className="truncate text-left">
              {selectedService
                ? `${selectedService.name} (${symbol}${Number(selectedService.price).toFixed(2)}/${selectedService.unit})`
                : t("select_service")}
            </span>
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-[max(var(--radix-popover-trigger-width),280px)] p-0" align="start">
        <Command
          filter={(itemValue, searchValue) =>
            normalizeServiceSearch(itemValue).includes(normalizeServiceSearch(searchValue)) ? 1 : 0
          }
        >
          <CommandInput
            placeholder={t("search_services")}
            aria-label={t("search_services")}
          />
          <CommandList
            className="max-h-[min(300px,calc(100dvh-12rem))] touch-pan-y overscroll-contain"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
            }}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{t("no_service_found")}</CommandEmpty>
            {groupedServices.map(([category, categoryServices]) => (
              <CommandGroup key={category} heading={category}>
                {categoryServices.map((service) => (
                  <CommandItem
                    key={service.id}
                    value={`${service.id} ${service.name} ${category}`}
                    onSelect={() => {
                      onChange(service.id);
                      setOpen(false);
                    }}
                    className="items-start py-2"
                  >
                    <Check
                      className={cn(
                        "mr-1 mt-0.5 h-4 w-4 shrink-0",
                        service.id === value ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm leading-tight">{service.name}</div>
                      <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                        {symbol}{Number(service.price).toFixed(2)}/{service.unit}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function buildOrderConfirmationWhatsAppMessage({
  order,
  symbol,
  businessName,
  language,
  paidAmount,
}: {
  order: any;
  symbol: string;
  businessName: string;
  language: string;
  paidAmount?: number;
}): string {
  const firstName = String(order.customer?.name || "").trim().split(/\s+/)[0] || "customer";
  const displayId = orderDisplayId(order);
  const total = Number(order.totalAmount) || 0;
  const paid = paidAmount ?? (order.payments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const balance = Math.max(0, total - paid);

  if (language.startsWith("fr")) {
    return [
      `Bonjour ${firstName},`,
      "",
      `Votre commande ${businessName} #${displayId} a bien été enregistrée.`,
      `Total : ${symbol}${total.toFixed(2)}.`,
      `Payé : ${symbol}${paid.toFixed(2)}.`,
      `Solde : ${balance === 0 ? "entièrement payé" : `${symbol}${balance.toFixed(2)}`}.`,
      "Votre reçu/facture est joint à ce message.",
      "Nous vous informerons quand la commande sera prête à récupérer.",
      "",
      "Merci.",
    ].join("\n");
  }

  if (language.startsWith("pt")) {
    return [
      `Olá ${firstName},`,
      "",
      `A sua encomenda ${businessName} #${displayId} foi registada.`,
      `Total: ${symbol}${total.toFixed(2)}.`,
      `Pago: ${symbol}${paid.toFixed(2)}.`,
      `Saldo: ${balance === 0 ? "totalmente pago" : `${symbol}${balance.toFixed(2)}`}.`,
      "O recibo/fatura está anexado a esta mensagem.",
      "Vamos avisar quando estiver pronta para recolha.",
      "",
      "Obrigado.",
    ].join("\n");
  }

  return [
    `Hello ${firstName},`,
    "",
    `Your ${businessName} order #${displayId} has been registered.`,
    `Total: ${symbol}${total.toFixed(2)}.`,
    `Paid: ${symbol}${paid.toFixed(2)}.`,
    `Balance: ${balance === 0 ? "fully paid" : `${symbol}${balance.toFixed(2)}`}.`,
    "Your receipt/invoice is attached to this message.",
    "We will notify you when the order is ready for pickup.",
    "",
    "Thank you.",
  ].join("\n");
}

export default function Orders() {
  const { data: orders, isLoading } = useOrders();
  const [search, setSearch] = useState("");
  const initialDashboardFilters = useMemo(dashboardOrderFilters, []);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(initialDashboardFilters.status);
  const [periodFilter, setPeriodFilter] = useState<OrderPeriodFilter>(initialDashboardFilters.period);
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const { openWhatsApp } = useWhatsAppLauncher();
  const symbol = getSymbol();
  const { data: settings } = useSettingsQuery<any>({ queryKey: ["/api/settings"] });
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  const createdOrderWhatsAppPhone = normalizeWhatsAppPhone(createdOrder?.customer?.phone);

  async function handleCreatedOrderWhatsApp() {
    if (!createdOrder || !createdOrderWhatsAppPhone) return;

    await generateDepositReceipt(createdOrder, symbol, {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
      receiptLanguage: settings?.receiptLanguage || i18n.language,
    }, "download");

    openWhatsApp({
      phone: createdOrderWhatsAppPhone,
      text: buildOrderConfirmationWhatsAppMessage({
      order: createdOrder,
      symbol,
      businessName: settings?.businessName || "Xpress Pro",
      language: i18n.language,
      }),
    });
  }

  const summary = useMemo(() => {
    if (!orders) return { total: 0, active: 0, ready: 0, unpaid: 0 };
    return {
      total: orders.length,
      active: orders.filter((o: any) => ACTIVE_STATUSES.has(o.status)).length,
      ready: orders.filter((o: any) => o.status === "ready").length,
      unpaid: orders.filter((o: any) => o.paymentStatus === "unpaid" || o.paymentStatus === "partial").length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let result = orders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o: any) =>
        o.id.toString().includes(q) ||
        (o.customer?.name || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter === "active") result = result.filter((o: any) => ACTIVE_STATUSES.has(o.status));
    if (statusFilter === "ready") result = result.filter((o: any) => o.status === "ready");
    if (statusFilter === "unpaid") result = result.filter((o: any) => o.paymentStatus === "unpaid" || o.paymentStatus === "partial");
    if (PIPELINE_STATUSES.has(statusFilter) && statusFilter !== "ready") {
      result = result.filter((o: any) => o.status === statusFilter);
    }
    if (periodFilter !== "all") {
      const now = new Date();
      const start = new Date(now);
      if (periodFilter === "today") start.setHours(0, 0, 0, 0);
      if (periodFilter === "week") {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      }
      if (periodFilter === "month") {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      }
      result = result.filter((o: any) => {
        const entryDate = new Date(o.entryDate || o.createdAt || 0);
        return o.status !== "cancelled" && entryDate >= start && entryDate <= now;
      });
    }
    return result;
  }, [orders, search, statusFilter, periodFilter]);

  const chips: { key: OrderStatusFilter; labelKey: string; count: number; color: string }[] = [
    { key: "all",    labelKey: "all",           count: summary.total,  color: "bg-muted text-foreground" },
    { key: "active", labelKey: "orders_active", count: summary.active, color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    { key: "ready",  labelKey: "orders_ready",  count: summary.ready,  color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
    { key: "unpaid", labelKey: "orders_unpaid", count: summary.unpaid, color: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  ];
  if (PIPELINE_STATUSES.has(statusFilter) && !chips.some((chip) => chip.key === statusFilter)) {
    chips.push({
      key: statusFilter,
      labelKey: `stage_${statusFilter}`,
      count: orders?.filter((order: any) => order.status === statusFilter).length || 0,
      color: "bg-primary/10 text-primary",
    });
  }

  return (
    <div className="space-y-5 page-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">{t('orders')}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("orders_subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-3 overflow-x-hidden overflow-y-auto overscroll-contain border-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[94dvh] sm:w-full sm:max-w-[700px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:p-6 sm:[scrollbar-gutter:stable] lg:max-h-[100dvh] lg:max-w-[1080px] lg:p-5">
            <DialogHeader className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 pb-3 backdrop-blur-sm">
              <DialogTitle>{t("create_new_order")}</DialogTitle>
            </DialogHeader>
            <OrderForm onSuccess={(orderDetails) => {
              setCreatedOrder(orderDetails);
              setOpen(false);
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!createdOrder} onOpenChange={(isOpen) => !isOpen && setCreatedOrder(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("order_registered")}</DialogTitle>
          </DialogHeader>
          {createdOrder && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-semibold">{createdOrder.customer?.name || t("unknown")}</div>
                <div className="text-muted-foreground">
                  #{orderDisplayId(createdOrder)} &bull; {symbol}{Number(createdOrder.totalAmount).toFixed(2)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/orders/${createdOrder.id}`}>
                  <Button variant="outline" className="w-full" onClick={() => setCreatedOrder(null)} data-testid="button-view-created-order">
                    <Eye className="w-4 h-4 mr-2" /> {t("view_order")}
                  </Button>
                </Link>
                <Button
                  className="w-full"
                  onClick={handleCreatedOrderWhatsApp}
                  disabled={!createdOrderWhatsAppPhone}
                  title={!createdOrderWhatsAppPhone ? t("customer_phone_missing") : undefined}
                  data-testid="button-send-order-confirmation-whatsapp"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> {t("notify_customer")}
                </Button>
              </div>
              {createdOrder.subscriptionCoverage && <div className="rounded-xl border p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><Star className="h-4 w-4 text-primary" />{t("subscription_coverage")}</div><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30"><p className="text-xs text-muted-foreground">{t("covered_by_subscription")}</p><p className="font-bold text-green-700">{symbol}{Number(createdOrder.subscriptionCoverage.coveredAmount).toFixed(2)}</p></div><div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30"><p className="text-xs text-muted-foreground">{t("extra_charges")}</p><p className="font-bold text-amber-700">{symbol}{Number(createdOrder.subscriptionCoverage.extraAmount).toFixed(2)}</p></div></div><p className="mt-3 text-center text-xs text-muted-foreground">{t("remaining_balance")}: {createdOrder.subscriptionCoverage.remainingAfter.kg ?? "—"} kg · {createdOrder.subscriptionCoverage.remainingAfter.pieces ?? "—"} pcs</p></div>}
              <p className="text-xs text-muted-foreground">
                {t("whatsapp_confirmation_hint")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map(chip => (
          <button
            key={chip.key}
            onClick={() => setStatusFilter(chip.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              statusFilter === chip.key
                ? "border-primary ring-1 ring-primary/30 shadow-sm"
                : "border-transparent hover:border-border",
              chip.color
            )}
          >
            {t(chip.labelKey)}
            <span className={cn(
              "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
              statusFilter === chip.key ? "bg-primary/15 text-primary" : "bg-black/10 dark:bg-white/10"
            )}>
              {chip.count}
            </span>
          </button>
        ))}
        {periodFilter !== "all" && (
          <button
            type="button"
            onClick={() => setPeriodFilter("all")}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t("clear_period_filter")}
            data-testid="button-clear-dashboard-period"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {periodFilter === "today" ? t("today") : periodFilter === "week" ? t("this_week") : t("this_month")}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Operations toolbar */}
      <div className="flex gap-2 p-2 rounded-lg border border-border bg-muted/30">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('search_orders')}
            className="pl-8 h-8 text-sm bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 shadow-sm shadow-primary/20 hover:-translate-y-px transition-all">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('new_order')}
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/60 text-muted-foreground text-xs font-semibold uppercase tracking-wide border-b border-border">
              <tr>
                <th className="px-3 py-2.5">{t("order_id_col")}</th>
                <th className="px-3 py-2.5">{t('customers')}</th>
                <th className="px-3 py-2.5">{t('date')}</th>
                <th className="px-3 py-2.5">{t('status')}</th>
                <th className="px-3 py-2.5">{t('payment')}</th>
                <th className="px-3 py-2.5 text-right">{t('amount')}</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{t("loading_orders")}</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <PackageOpen className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-muted-foreground text-sm">{t("no_orders_found")}</p>
                      {!search && statusFilter === "all" && (
                        <Dialog open={open} onOpenChange={setOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">{t('new_order')}</Button>
                          </DialogTrigger>
                        </Dialog>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => (
                  <tr key={order.id} className="group hover:bg-muted/25 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-muted-foreground">
                      #{orderDisplayId(order)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground leading-tight">{order.customer?.name || t("unknown")}</div>
                      {order.customer?.phone && (
                        <div className="text-xs text-muted-foreground mt-0.5">{order.customer.phone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {format(new Date(order.entryDate || order.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={order.status} />
                        {order.hasReturnedItems && (
                          <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums">
                      {symbol}{Number(order.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 border-2 border-dashed border-border rounded-xl text-center">
            <PackageOpen className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">{t("no_orders_found")}</p>
              {!search && statusFilter === "all" && (
                <p className="text-sm text-muted-foreground mt-1">{t("orders_empty_hint")}</p>
              )}
            </div>
            {!search && statusFilter === "all" && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />{t('new_order')}
                  </Button>
                </DialogTrigger>
              </Dialog>
            )}
          </div>
        ) : (
          filteredOrders.map((order: any) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="border-border/50 shadow-sm active:scale-[0.99] transition-transform cursor-pointer" data-testid={`card-order-${order.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: customer + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-foreground truncate text-sm">{order.customer?.name || t("unknown")}</span>
                        {order.hasReturnedItems && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span className="font-mono font-medium">#{orderDisplayId(order)}</span>
                        <span>·</span>
                        <span>{format(new Date(order.entryDate || order.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={order.status} />
                        <StatusBadge status={order.paymentStatus} />
                      </div>
                    </div>
                    {/* Right: amount + chevron */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono font-bold text-sm tabular-nums">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function OrderForm({ onSuccess }: { onSuccess: (orderDetails: any) => void }) {
  const { t, i18n } = useTranslation();
  const { mutate: createOrder, isPending: isOrderPending } = useCreateOrder();
  const { mutate: createCustomer, isPending: isCustomerPending } = useCreateCustomer();
  const { toast } = useToast();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const activeServices = useMemo(() => services?.filter((service) => service.active) || [], [services]);
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const { data: settings } = useSettingsQuery<any>({ queryKey: ["/api/settings"] });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [discountMode, setDiscountMode] = useState<"fixed" | "percentage">("fixed");

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderWithItemsSchema),
    defaultValues: {
      status: "pending",
      paymentStatus: "unpaid",
      entryDate: format(new Date(), "yyyy-MM-dd"),
      discount: "0",
      discountPct: 0,
      pickupCost: "0",
      advancePayment: "0",
      advancePaymentMethod: "Cash",
      items: [{ serviceId: 0, quantity: 1 }],
      garmentItems: [],
      machineUsages: [],
    }
  });

  const customerForm = useForm<z.infer<typeof insertCustomerSchema>>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: { name: "", phone: "", address: "" }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const { fields: garmentFields, append: appendGarment, remove: removeGarment } = useFieldArray({
    control: form.control,
    name: "garmentItems"
  });

  const watchedItems = useWatch({
    control: form.control,
    name: "items"
  });

  const watchedGarmentItems = useWatch({
    control: form.control,
    name: "garmentItems"
  });

  const watchedDiscount = useWatch({
    control: form.control,
    name: "discount"
  });

  const watchedDiscountPct = useWatch({
    control: form.control,
    name: "discountPct"
  });

  const watchedPickupCost = useWatch({
    control: form.control,
    name: "pickupCost"
  });

  const watchedAdvancePayment = useWatch({
    control: form.control,
    name: "advancePayment"
  });

  const watchedCustomerId = useWatch({
    control: form.control,
    name: "customerId"
  });
  const { data: activeSub } = useQuery<any>({ queryKey: ["customer-active-sub", watchedCustomerId], queryFn: async () => { const r = await fetch(`/api/customers/${watchedCustomerId}/subscription/active`, { credentials: "include" }); if (!r.ok) throw new Error("Unable to load subscription"); return r.json(); }, enabled: !!watchedCustomerId });

  const selectedCustomer = customers?.find((c: any) => c.id === Number(watchedCustomerId));
  const customerDiscountPct = Number(selectedCustomer?.defaultDiscountPct || 0);

  const subtotal = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => {
      const service = services?.find(s => s.id === item.serviceId);
      if (!service) return acc;
      return acc + (Number(service.price) * (item.quantity || 0));
    }, 0);
  }, [watchedItems, services]);

  useEffect(() => {
    if (!watchedCustomerId || !customers) return;
    const customer = customers.find((c: any) => c.id === Number(watchedCustomerId));
    if (!customer || !Number(customer.defaultDiscountPct)) return;
    const pct = Number(customer.defaultDiscountPct);
    if (subtotal > 0 && pct > 0) {
      setDiscountMode("percentage");
      form.setValue("discountPct", pct);
      form.setValue("discount", ((subtotal * pct) / 100).toFixed(2));
    }
  }, [watchedCustomerId, customers, subtotal]);

  const discountAmount = useMemo(() => {
    if (discountMode === "percentage") {
      const raw = Number(watchedDiscountPct);
      const pct = Math.min(100, Math.max(0, isNaN(raw) ? 0 : raw));
      return Math.min(subtotal, subtotal * pct / 100);
    }
    const raw = Number(watchedDiscount);
    return Math.min(subtotal, Math.max(0, isNaN(raw) ? 0 : raw));
  }, [discountMode, subtotal, watchedDiscount, watchedDiscountPct]);

  const total = useMemo(() => {
    const pickupVal = Number(watchedPickupCost) || 0;
    return Math.max(0, subtotal - discountAmount + pickupVal);
  }, [subtotal, discountAmount, watchedPickupCost]);

  const totalRegisteredGarments = useMemo(() => {
    return (watchedGarmentItems || []).reduce((sum, garment) => {
      if (!garment?.itemName?.trim()) return sum;
      return sum + Math.max(0, Number(garment.quantity) || 0);
    }, 0);
  }, [watchedGarmentItems]);

  function onAddCustomerSubmit(data: z.infer<typeof insertCustomerSchema>) {
    createCustomer(data, {
      onSuccess: (newCustomer) => {
        form.setValue("customerId", newCustomer.id);
        setShowAddCustomer(false);
        customerForm.reset();
      }
    });
  }

  async function onSubmit(data: CreateOrderFormValues) {
    const formattedData = {
      ...data,
      discount: discountAmount.toFixed(2),
      discountPct: discountMode === "percentage" ? Number(data.discountPct || 0) : 0,
      customerId: Number(data.customerId),
      items: data.items.map(item => ({
        serviceId: Number(item.serviceId),
        quantity: Number(item.quantity)
      })),
      garmentItems: (data.garmentItems || []).filter(g => g.itemName.trim() !== "").map(g => ({
        itemName: g.itemName.trim(),
        quantity: Number(g.quantity),
      })),
      machineUsages: (data.machineUsages || []).filter(m => Number(m.machineId) > 0).map(m => ({
        machineId: Number(m.machineId),
        weightProcessed: String(m.weightProcessed || "0"),
        cycleDurationMinutes: Number(m.cycleDurationMinutes || 0),
      })),
    };

    if (activeSub?.id) {
      try {
        const preview = await fetch("/api/subscriptions/calculate-coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ customerSubscriptionId: activeSub.id, customerId: formattedData.customerId, items: formattedData.items, garmentPieceCount: totalRegisteredGarments }),
        });
        const payload = await preview.json().catch(() => null);
        if (!preview.ok) throw new Error(payload?.message || "Unable to calculate subscription coverage");
      } catch (error) {
        toast({ title: "Unable to save subscribed order", description: error instanceof Error ? error.message : "Subscription coverage could not be calculated.", variant: "destructive" });
        return;
      }
    }

    createOrder(formattedData, {
      onSuccess: async (newOrder: any) => {
        let orderDetails = newOrder;
        try {
          if (activeSub?.id) {
            const apply = await fetch("/api/subscriptions/apply-to-order", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ customerSubscriptionId: activeSub.id, orderId: newOrder.id }) });
            const payload = await apply.json().catch(() => null);
            if (!apply.ok) throw new Error(payload?.message || "Order saved, but subscription coverage could not be applied");
            orderDetails.subscriptionCoverage = payload.coverage;
          }
          const res = await fetch(`/api/orders/${newOrder.id}`, { credentials: "include" });
          if (res.ok) {
            orderDetails = { ...(await res.json()), subscriptionCoverage: orderDetails.subscriptionCoverage };
            if (activeSub?.id) {
              const subscriberReceipt = await fetch(`/api/orders/${newOrder.id}/subscriber-receipt?format=a4`, { credentials: "include" });
              if (!subscriberReceipt.ok) throw new Error("Subscriber receipt could not be generated");
              const html = await subscriberReceipt.text();
              downloadReceiptHtml(html, `subscriber-receipt-order-${orderDisplayId(orderDetails)}.html`);
            } else {
              await generateDepositReceipt(orderDetails, symbol, {
                ...DEFAULT_SETTINGS,
                ...(settings || {}),
                receiptLanguage: settings?.receiptLanguage || i18n.language,
              }, "download");
            }
          }
        } catch (error) {
          toast({
            title: "Subscription coverage not applied",
            description: error instanceof Error ? error.message : "The order was saved without deducting the subscription balance.",
            variant: "destructive",
          });
        }
        form.reset();
        onSuccess(orderDetails);
      }
    });
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 lg:space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b pb-3 sm:pb-4">
        <h3 className="min-w-0 text-base font-semibold sm:text-lg">{t("order_details")}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddCustomer(!showAddCustomer)}
        >
          <UserPlus className="h-4 w-4 shrink-0 sm:mr-2" aria-hidden="true" />
          <span className="hidden sm:inline">{showAddCustomer ? t("select_existing") : t("register_new_customer")}</span>
          <span className="sm:hidden">{showAddCustomer ? t("customers") : t("add_customer")}</span>
        </Button>
      </div>

      {showAddCustomer ? (
        <Form {...customerForm}>
          <form onSubmit={customerForm.handleSubmit(onAddCustomerSubmit)} className="space-y-4 p-4 bg-muted/20 rounded-lg border">
            <h4 className="font-medium text-sm">{t("quick_register_customer")}</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={customerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t("name")}</FormLabel>
                    <FormControl><Input placeholder={t("customer_name_placeholder")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={customerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t("phone")}</FormLabel>
                    <FormControl><Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+1…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={customerForm.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t("address")}</FormLabel>
                  <FormControl><Input placeholder={t("street_address_placeholder")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" className="w-full" disabled={isCustomerPending}>
              {isCustomerPending ? t("registering") : t("register_and_select")}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 lg:space-y-3">
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("customers")}</FormLabel>
                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? customers?.find((c) => c.id === field.value)?.name
                              : t("select_customer")}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder={t("search_customers")} />
                          <CommandList>
                            <CommandEmpty>{t("no_customer_found")}</CommandEmpty>
                            <CommandGroup>
                              {customers?.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={customer.name}
                                  onSelect={() => {
                                    form.setValue("customerId", customer.id);
                                    setCustomerSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      customer.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {customer.name} ({customer.phone})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-4">
                <FormField
                  control={form.control}
                  name="entryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("date_of_entry")}</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pickupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pickup_date")}</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {activeSub && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20 sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary"><Star className="h-3.5 w-3.5 text-white" aria-hidden="true" /></span><span className="truncate text-sm font-semibold text-primary">Membre {activeSub.planName}</span><span className="shrink-0 text-xs text-muted-foreground">#{activeSub.membershipNumber}</span></div><span className="text-xs text-muted-foreground">{t("expires")} {activeSub.expiryDate}</span></div><div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-3">{activeSub.remainingKg != null && <div className="rounded-lg bg-white p-2 dark:bg-card"><p className="font-bold text-primary">{activeSub.remainingKg} kg</p><p className="text-muted-foreground">{t("remaining_balance")}</p></div>}{activeSub.remainingPieces != null && <div className="rounded-lg bg-white p-2 dark:bg-card"><p className="font-bold text-primary">{activeSub.remainingPieces}</p><p className="text-muted-foreground">Pièces</p></div>}{activeSub.remainingOrders != null && <div className="rounded-lg bg-white p-2 dark:bg-card"><p className="font-bold text-primary">{activeSub.remainingOrders}</p><p className="text-muted-foreground">Commandes</p></div>}</div></div>}

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-start lg:gap-4">
              <div className="min-w-0 space-y-4" data-testid="order-form-primary-column">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">{t('order_services', 'Order Services')}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ serviceId: 0, quantity: 1 })}>
                      <Plus className="w-3 h-3 mr-1" /> {t('add_service', 'Add Service')}
                    </Button>
                  </div>

              {fields.map((field, index) => {
                const selectedService = services?.find(s => s.id === watchedItems[index]?.serviceId);
                const itemPrice = selectedService ? Number(selectedService.price) * (watchedItems[index]?.quantity || 0) : 0;

                return (
                  <div key={field.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] items-end gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_2.25rem] sm:gap-3 sm:p-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.serviceId`}
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel className="text-xs">{t("service")}</FormLabel>
                          <ServiceCombobox
                            services={activeServices}
                            value={Number(field.value) || 0}
                            onChange={field.onChange}
                            symbol={symbol}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel className="text-xs">{t("qty")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className="h-9"
                              {...field}
                              onChange={e => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="col-span-2 row-start-2 flex min-w-0 items-center justify-between px-1 pb-1 text-right sm:col-span-1 sm:row-start-auto sm:block sm:px-0 sm:pb-2">
                      <span className="text-xs text-muted-foreground block">{t("price")}</span>
                      <span className="font-mono text-sm font-medium">{symbol}{itemPrice.toFixed(2)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

                <div className="space-y-3" data-testid="garment-inventory-section">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">{t('garment_inventory', 'Garment Inventory')}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground" aria-live="polite" data-testid="text-total-registered-garments">
                    {t("total_registered_items", "Total registered items")}: <span className="font-mono text-foreground">{totalRegisteredGarments}</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendGarment({ itemName: "", quantity: 1 })}>
                    <Plus className="w-3 h-3 mr-1" /> {t('add_garment', 'Add Garment')}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('garment_inventory_hint', 'Track individual garment items for this order (not billed separately)')}</p>

              {garmentFields.map((field, index) => (
                <div key={field.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] items-end gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 sm:gap-3 sm:p-3">
                  <FormField
                    control={form.control}
                    name={`garmentItems.${index}.itemName`}
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel className="text-xs">{t('item_name', 'Item Name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('garment_placeholder', 'e.g. Shirt, Trousers, Dress')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`garmentItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel className="text-xs">{t('qty', 'Qty')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeGarment(index)}
                    data-testid={`button-remove-garment-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
                </div>
              </div>

              <div className="min-w-0 space-y-2 rounded-xl border bg-muted/10 p-4 lg:p-3 lg:space-y-2 lg:sticky lg:top-0" data-testid="order-form-summary-column">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t("subtotal")}:</span>
                <span className="font-mono font-semibold">{symbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
                <div className="space-y-2">
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-medium text-muted-foreground">{t("discount_type")}</legend>
                    <div className="grid grid-cols-2 rounded-lg border bg-muted/60 p-1" role="group" aria-label={t("discount_type")}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors ${
                          discountMode === "fixed"
                            ? "bg-background text-foreground shadow-sm hover:bg-background"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        }`}
                        aria-pressed={discountMode === "fixed"}
                        onClick={() => {
                          form.setValue("discount", discountAmount.toFixed(2));
                          form.setValue("discountPct", 0);
                          setDiscountMode("fixed");
                        }}
                        data-testid="button-discount-fixed"
                      >
                        {t("fixed_amount")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors ${
                          discountMode === "percentage"
                            ? "bg-background text-foreground shadow-sm hover:bg-background"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        }`}
                        aria-pressed={discountMode === "percentage"}
                        onClick={() => {
                          form.setValue("discountPct", subtotal > 0 ? Number(((discountAmount / subtotal) * 100).toFixed(2)) : 0);
                          setDiscountMode("percentage");
                        }}
                        data-testid="button-discount-percentage"
                      >
                        {t("percentage")}
                      </Button>
                    </div>
                  </fieldset>
                  {discountMode === "fixed" ? (
                    <FormField
                      control={form.control}
                      name="discount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">{t("discount")} ({symbol})</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max={subtotal} className="h-8 text-right font-mono" {...field} data-testid="input-discount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="discountPct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">{t("discount")} (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="h-8 text-right font-mono"
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              value={field.value ?? ""}
                              onFocus={(e) => e.target.select()}
                              onChange={(event) => {
                                const percentage = event.currentTarget.valueAsNumber;
                                field.onChange(Number.isNaN(percentage) ? 0 : percentage);
                              }}
                              data-testid="input-discount-percentage"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {customerDiscountPct > 0 && (
                    <p className="text-xs text-primary">{t("customer_default_discount", { percentage: customerDiscountPct })}</p>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="pickupCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        {t("pickup_cost")} ({symbol})
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-8 text-right font-mono" {...field} data-testid="input-pickup-cost" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {(Number(watchedPickupCost) > 0 || discountAmount > 0) && (
                <div className="text-xs text-muted-foreground space-y-1 px-1">
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span>- {t("discount")}:</span>
                      <span className="font-mono text-destructive">-{symbol}{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {Number(watchedPickupCost) > 0 && (
                    <div className="flex justify-between">
                      <span>+ {t("pickup_cost")}:</span>
                      <span className="font-mono text-primary">+{symbol}{Number(watchedPickupCost).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-bold bg-primary/5 p-3 rounded-lg">
                <span>{t("total")}:</span>
                <span className="font-mono text-primary">{symbol}{total.toFixed(2)}</span>
              </div>

              <div className="border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 rounded-lg p-4 lg:p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{t("advance_payment")} — {t("enter_advance")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="advancePayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t("advance_payment")} ({symbol})</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-8 text-right font-mono" {...field} data-testid="input-advance-payment" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="advancePaymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t("advance_payment_method")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-8" data-testid="select-advance-method">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {Number(watchedAdvancePayment) > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-amber-200 dark:border-amber-700">
                    <span className="text-sm font-semibold text-muted-foreground">{t("remaining_balance")}:</span>
                    <span className={`font-mono font-bold text-base ${Math.max(0, total - Number(watchedAdvancePayment)) === 0 ? "text-green-600" : "text-destructive"}`}>
                      {Math.max(0, total - Number(watchedAdvancePayment)) === 0
                        ? `✓ ${t("fully_paid_label")}`
                        : `${symbol}${Math.max(0, total - Number(watchedAdvancePayment)).toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 -mx-1 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur-sm">
              <Button type="submit" className="w-full" size="lg" disabled={isOrderPending}>
                {isOrderPending ? t("saving") : t("create_new_order")}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
