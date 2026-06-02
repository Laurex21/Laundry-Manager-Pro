import { useState, useMemo, useEffect } from "react";
import { useOrders, useCreateOrder } from "@/hooks/use-orders";
import { useCustomers, useCreateCustomer } from "@/hooks/use-customers";
import { useServices } from "@/hooks/use-services";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrderWithItemsSchema } from "@shared/routes";
import { insertCustomerSchema } from "@shared/schema";
import { z } from "zod";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { generateDepositReceipt } from "@/lib/receipt";
import { useQuery as useSettingsQuery } from "@tanstack/react-query";
import { DEFAULT_SETTINGS } from "@/lib/receipt-settings";
import {
  Plus,
  Search,
  Trash2,
  ChevronRight,
  UserPlus,
  Check,
  Shirt,
  AlertTriangle,
  PackageOpen
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

type CreateOrderFormValues = z.infer<typeof createOrderWithItemsSchema>;

const ACTIVE_STATUSES = new Set(["pending", "washing", "drying", "ironing", "stain_treatment", "received"]);

export default function Orders() {
  const { data: orders, isLoading } = useOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ready" | "unpaid">("all");
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data: settings } = useSettingsQuery<any>({ queryKey: ["/api/settings"] });

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
    return result;
  }, [orders, search, statusFilter]);

  const chips: { key: typeof statusFilter; labelKey: string; count: number; color: string }[] = [
    { key: "all",    labelKey: "all",           count: summary.total,  color: "bg-muted text-foreground" },
    { key: "active", labelKey: "orders_active", count: summary.active, color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    { key: "ready",  labelKey: "orders_ready",  count: summary.ready,  color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
    { key: "unpaid", labelKey: "orders_unpaid", count: summary.unpaid, color: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">{t('orders')}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("orders_subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("create_new_order")}</DialogTitle>
            </DialogHeader>
            <OrderForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

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
                      #{order.id}
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
                        <span className="font-mono font-medium">#{order.id}</span>
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

function OrderForm({ onSuccess }: { onSuccess: () => void }) {
  const { t, i18n } = useTranslation();
  const { mutate: createOrder, isPending: isOrderPending } = useCreateOrder();
  const { mutate: createCustomer, isPending: isCustomerPending } = useCreateCustomer();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const { data: settings } = useSettingsQuery<any>({ queryKey: ["/api/settings"] });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderWithItemsSchema),
    defaultValues: {
      status: "pending",
      paymentStatus: "unpaid",
      entryDate: format(new Date(), "yyyy-MM-dd"),
      discount: "0",
      pickupCost: "0",
      advancePayment: "0",
      advancePaymentMethod: "Cash",
      items: [{ serviceId: 0, quantity: 1 }],
      garmentItems: [],
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

  const watchedDiscount = useWatch({
    control: form.control,
    name: "discount"
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

  const selectedCustomer = customers?.find((c: any) => c.id === Number(watchedCustomerId));
  const customerDiscountPct = Number(selectedCustomer?.defaultDiscountPct || 0);

  const hasKgService = useMemo(() => {
    return (watchedItems || []).some(item => {
      const service = services?.find(s => s.id === item.serviceId);
      return service?.unit === "kg";
    });
  }, [watchedItems, services]);

  useEffect(() => {
    if (!hasKgService && garmentFields.length > 0) {
      form.setValue("garmentItems", []);
    }
  }, [hasKgService]);

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
      form.setValue("discount", ((subtotal * pct) / 100).toFixed(2));
    }
  }, [watchedCustomerId, customers, subtotal]);

  const total = useMemo(() => {
    const discountVal = Number(watchedDiscount) || 0;
    const pickupVal = Number(watchedPickupCost) || 0;
    return Math.max(0, subtotal - discountVal + pickupVal);
  }, [subtotal, watchedDiscount, watchedPickupCost]);

  function onAddCustomerSubmit(data: z.infer<typeof insertCustomerSchema>) {
    createCustomer(data, {
      onSuccess: (newCustomer) => {
        form.setValue("customerId", newCustomer.id);
        setShowAddCustomer(false);
        customerForm.reset();
      }
    });
  }

  function onSubmit(data: CreateOrderFormValues) {
    const formattedData = {
      ...data,
      customerId: Number(data.customerId),
      items: data.items.map(item => ({
        serviceId: Number(item.serviceId),
        quantity: Number(item.quantity)
      })),
      garmentItems: hasKgService ? (data.garmentItems || []).filter(g => g.itemName.trim() !== "").map(g => ({
        itemName: g.itemName.trim(),
        quantity: Number(g.quantity),
      })) : [],
    };

    createOrder(formattedData, {
      onSuccess: async (newOrder: any) => {
        try {
          const res = await fetch(`/api/orders/${newOrder.id}`, { credentials: "include" });
          if (res.ok) {
            const orderDetails = await res.json();
            generateDepositReceipt(orderDetails, symbol, {
              ...DEFAULT_SETTINGS,
              ...(settings || {}),
              receiptLanguage: settings?.receiptLanguage || i18n.language,
            });
          }
        } catch {}
        form.reset();
        onSuccess();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="font-semibold text-lg">{t("order_details")}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddCustomer(!showAddCustomer)}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {showAddCustomer ? t("select_existing") : t("register_new_customer")}
        </Button>
      </div>

      {showAddCustomer ? (
        <Form {...customerForm}>
          <form onSubmit={customerForm.handleSubmit(onAddCustomerSubmit)} className="space-y-4 p-4 bg-muted/20 rounded-lg border">
            <h4 className="font-medium text-sm">{t("quick_register_customer")}</h4>
            <div className="grid grid-cols-2 gap-4">
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
                    <FormControl><Input placeholder="+1..." {...field} /></FormControl>
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-4">
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
                  <div key={field.id} className="flex gap-3 items-end p-3 bg-muted/20 rounded-lg border border-border/50">
                    <FormField
                      control={form.control}
                      name={`items.${index}.serviceId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">{t("service")}</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            value={field.value > 0 ? field.value.toString() : ""}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={t("select_service")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {services?.filter(s => s.active).map((service) => (
                                <SelectItem key={service.id} value={service.id.toString()}>
                                  {service.name} ({symbol}{Number(service.price).toFixed(2)}/{service.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-20">
                          <FormLabel className="text-xs">{t("qty")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              className="h-9"
                              {...field}
                              onChange={e => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="w-24 pb-2 text-right">
                      <span className="text-xs text-muted-foreground block">{t("price")}</span>
                      <span className="font-mono font-medium">{symbol}{itemPrice.toFixed(2)}</span>
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

            {hasKgService && (
              <div className="space-y-4" data-testid="garment-inventory-section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">{t('garment_inventory', 'Garment Inventory')}</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendGarment({ itemName: "", quantity: 1 })}>
                    <Plus className="w-3 h-3 mr-1" /> {t('add_garment', 'Add Garment')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('garment_inventory_hint', 'Track individual garment items for this order (not billed separately)')}</p>

                {garmentFields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-end p-3 bg-muted/20 rounded-lg border border-border/50">
                    <FormField
                      control={form.control}
                      name={`garmentItems.${index}.itemName`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
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
                        <FormItem className="w-20">
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
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t("subtotal")}:</span>
                <span className="font-mono font-semibold">{symbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        {t("discount")} ({symbol})
                        {customerDiscountPct > 0 && (
                          <span className="ml-1 text-primary font-medium">({customerDiscountPct}%)</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" className="h-8 text-right font-mono" {...field} data-testid="input-discount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              {(Number(watchedPickupCost) > 0 || Number(watchedDiscount) > 0) && (
                <div className="text-xs text-muted-foreground space-y-1 px-1">
                  {Number(watchedDiscount) > 0 && (
                    <div className="flex justify-between">
                      <span>- {t("discount")}:</span>
                      <span className="font-mono text-destructive">-{symbol}{Number(watchedDiscount).toFixed(2)}</span>
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
              <div className="flex justify-between items-center text-lg font-bold bg-primary/5 p-4 rounded-lg">
                <span>{t("total")}:</span>
                <span className="font-mono text-primary">{symbol}{total.toFixed(2)}</span>
              </div>

              <div className="border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 rounded-lg p-4 space-y-3">
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

            <Button type="submit" className="w-full" size="lg" disabled={isOrderPending}>
              {isOrderPending ? t("saving") : t("create_new_order")}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
