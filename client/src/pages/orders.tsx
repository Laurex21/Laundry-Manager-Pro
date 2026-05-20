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
  Filter,
  Trash2,
  ChevronRight,
  UserPlus,
  Check,
  Shirt,
  AlertTriangle
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CreateOrderFormValues = z.infer<typeof createOrderWithItemsSchema>;

export default function Orders() {
  const { data: orders, isLoading } = useOrders();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data: settings } = useSettingsQuery<any>({ queryKey: ["/api/settings"] });

  const filteredOrders = orders?.filter((o: any) => 
    o.id.toString().includes(search) || 
    o.customer?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">{t('orders')}</h1>
          <p className="text-muted-foreground mt-1">Manage laundry orders and status</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
            </DialogHeader>
            <OrderForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('search_orders')} 
            className="pl-10 bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">{t('customers')}</th>
                <th className="px-6 py-4">{t('date')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4">{t('payment')}</th>
                <th className="px-6 py-4 text-right">{t('amount')}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading orders...</td>
                </tr>
              ) : filteredOrders?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No orders found.</td>
                </tr>
              ) : (
                filteredOrders?.map((order: any) => (
                  <tr key={order.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium">#{order.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{order.customer?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{order.customer?.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={order.status} />
                        {order.hasReturnedItems && (
                          <span className="text-orange-500" title="Has returned garments">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium">
                      {symbol}{Number(order.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <ChevronRight className="w-4 h-4" />
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
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredOrders?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            No orders found.
          </div>
        ) : (
          filteredOrders?.map((order: any) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="border-border/50 shadow-sm active:scale-[0.98] transition-transform cursor-pointer" data-testid={`card-order-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-foreground truncate">{order.customer?.name || "Unknown"}</span>
                        {order.hasReturnedItems && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">#{order.id} · {format(new Date(order.createdAt), "MMM d, yyyy")}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <StatusBadge status={order.status} />
                        <StatusBadge status={order.paymentStatus} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-base">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
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
  const { t } = useTranslation();
  const { mutate: createOrder, isPending: isOrderPending } = useCreateOrder();
  const { mutate: createCustomer, isPending: isCustomerPending } = useCreateCustomer();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderWithItemsSchema),
    defaultValues: {
      status: "pending",
      paymentStatus: "unpaid",
      entryDate: format(new Date(), "yyyy-MM-dd"),
      discount: "0",
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
    return Math.max(0, subtotal - discountVal);
  }, [subtotal, watchedDiscount]);

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
            generateDepositReceipt(orderDetails, symbol, settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS);
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
        <h3 className="font-semibold text-lg">Order Details</h3>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAddCustomer(!showAddCustomer)}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {showAddCustomer ? "Select Existing" : "Register New Customer"}
        </Button>
      </div>

      {showAddCustomer ? (
        <Form {...customerForm}>
          <form onSubmit={customerForm.handleSubmit(onAddCustomerSubmit)} className="space-y-4 p-4 bg-muted/20 rounded-lg border">
            <h4 className="font-medium text-sm">Quick Register Customer</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={customerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Name</FormLabel>
                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={customerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Phone</FormLabel>
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
                  <FormLabel className="text-xs">Address</FormLabel>
                  <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" className="w-full" disabled={isCustomerPending}>
              {isCustomerPending ? "Registering..." : "Register & Select"}
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
                    <FormLabel>Customer</FormLabel>
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
                              : "Select customer..."}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder="Search customers..." />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
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
                      <FormLabel>Date of Entry</FormLabel>
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
                      <FormLabel>Pick-up Date</FormLabel>
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
                          <FormLabel className="text-xs">Service</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            value={field.value > 0 ? field.value.toString() : ""}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select service" />
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
                          <FormLabel className="text-xs">Qty</FormLabel>
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
                      <span className="text-xs text-muted-foreground block">Price</span>
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

            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono font-semibold">{symbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center max-w-[200px] ml-auto">
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-xs text-muted-foreground">
                        Discount ({symbol})
                        {customerDiscountPct > 0 && (
                          <span className="ml-1 text-primary font-medium">({customerDiscountPct}% applied)</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" className="h-8 text-right font-mono" {...field} data-testid="input-discount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-between items-center text-lg font-bold bg-primary/5 p-4 rounded-lg">
                <span>Total:</span>
                <span className="font-mono text-primary">{symbol}{total.toFixed(2)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isOrderPending}>
              {isOrderPending ? "Creating Order..." : "Create Order"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
