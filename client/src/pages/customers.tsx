import { useState } from "react";
import { useCustomers, useCreateCustomer } from "@/hooks/use-customers";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomerSchema, type InsertCustomer } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
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
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('customers')}</h1>
          <p className="text-muted-foreground mt-1">Manage your customer base</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> {t('add_customer')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <CustomerForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder={t('search_customers')} 
          className="pl-10 max-w-sm bg-background border-border focus:ring-primary/20 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers?.map((customer) => (
            <Card
              key={customer.id}
              className="group cursor-pointer hover-elevate transition-all duration-300 border-border/50"
              onClick={() => navigate(`/customers/${customer.id}`)}
              data-testid={`card-customer-${customer.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-muted bg-muted">
                      <AvatarFallback className="font-bold text-primary text-lg">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-lg leading-none">{customer.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">ID: #{customer.id}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </div>
                
                <div className="mt-6 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 text-primary/70" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4 text-primary/70" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary/70 mt-0.5" />
                    <span className="flex-1">{customer.address}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredCustomers?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
              No customers found. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerForm({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateCustomer();
  
  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: ""
    }
  });

  function onSubmit(data: InsertCustomer) {
    mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
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
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 234..." {...field} />
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
                <FormLabel>Email (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" {...field} value={field.value || ""} />
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
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, City" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full mt-2" disabled={isPending}>
          {isPending ? "Creating..." : "Create Customer"}
        </Button>
      </form>
    </Form>
  );
}
