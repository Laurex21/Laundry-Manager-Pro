import { useState } from "react";
import { useOrders, useCreateOrder } from "@/hooks/use-orders";
import { useCustomers } from "@/hooks/use-customers";
import { useServices } from "@/hooks/use-services";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrderWithItemsSchema } from "@shared/routes";
import { z } from "zod";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Plus, 
  Search, 
  Filter,
  Trash2,
  ChevronRight
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";

type CreateOrderFormValues = z.infer<typeof createOrderWithItemsSchema>;

export default function Orders() {
  const { data: orders, isLoading } = useOrders();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  // Simple search filtering
  const filteredOrders = orders?.filter((o: any) => 
    o.id.toString().includes(search) || 
    o.customer?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('orders')}</h1>
          <p className="text-muted-foreground mt-1">Manage laundry orders and status</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

      <Card className="border-border/50 shadow-sm overflow-hidden">
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
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium">
                      ${Number(order.totalAmount).toFixed(2)}
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
    </div>
  );
}

function OrderForm({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateOrder();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  
  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderWithItemsSchema),
    defaultValues: {
      status: "pending",
      paymentStatus: "unpaid",
      items: [{ serviceId: 0, quantity: 1 }] // Initial row
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  function onSubmit(data: CreateOrderFormValues) {
    // Convert string inputs to numbers if Zod doesn't handle it
    const formattedData = {
      ...data,
      customerId: Number(data.customerId),
      items: data.items.map(item => ({
        serviceId: Number(item.serviceId),
        quantity: Number(item.quantity)
      }))
    };
    
    mutate(formattedData, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer</FormLabel>
              <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name} ({customer.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Order Items</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ serviceId: 0, quantity: 1 })}>
              <Plus className="w-3 h-3 mr-1" /> Add Item
            </Button>
          </div>
          
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-3 items-end p-3 bg-muted/20 rounded-lg border border-border/50">
              <FormField
                control={form.control}
                name={`items.${index}.serviceId`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-xs">Service</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services?.filter(s => s.active).map((service) => (
                          <SelectItem key={service.id} value={service.id.toString()}>
                            {service.name} (${Number(service.price).toFixed(2)}/{service.unit})
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
                  <FormItem className="w-24">
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
          ))}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending ? "Creating Order..." : "Create Order"}
        </Button>
      </form>
    </Form>
  );
}
