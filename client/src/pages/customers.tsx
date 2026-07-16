import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  ChevronRight,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "vip" | "none">("all");
  const [showMembershipColumns, setShowMembershipColumns] = useState(false);
  const { data: subscriptionSummaries = {} } = useQuery<Record<string, any>>({ queryKey: ["/api/customer-subscription-summaries"] });
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const filteredCustomers = customers?.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const sub = subscriptionSummaries[String(c.id)];
    const matchesFilter = filter === "all" || (filter === "active" && sub?.status === "active") || (filter === "expired" && (sub?.status === "expired" || (sub?.expiryDate && new Date(sub.expiryDate) < new Date()))) || (filter === "vip" && c.segment === "vip") || (filter === "none" && !sub);
    return matchesSearch && matchesFilter;
  });

  const totalCount = customers?.length ?? 0;

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold leading-tight">{t("customers")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("clients_subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1.5" /> {t("add_customer")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("add_new_customer")}</DialogTitle>
            </DialogHeader>
            <CustomerForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("search_customers")}
            className="pl-9 h-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap rounded-md border bg-background p-0.5">{[["all","Tous les clients"],["active","Membres actifs"],["expired","Membres expirés"],["vip","VIP"],["none","Sans abonnement"]].map(([value,label])=><Button key={value} type="button" variant={filter === value ? "secondary" : "ghost"} size="sm" className="h-8 px-3 text-xs" onClick={() => setFilter(value as any)}>{label}</Button>)}</div>
        <Button variant="outline" size="sm" onClick={()=>setShowMembershipColumns(v=>!v)}>Colonnes</Button>
        {!isLoading && (
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {t("n_customers", { count: filteredCustomers?.length ?? totalCount })}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-24 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : filteredCustomers && filteredCustomers.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors group"
              onClick={() => navigate(`/customers/${customer.id}`)}
              data-testid={`card-customer-${customer.id}`}
            >
              <Avatar className="h-9 w-9 shrink-0 border border-border bg-muted text-sm">
                <AvatarFallback className="font-semibold text-primary text-sm">
                  {customer.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-snug truncate">{customer.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="truncate">{customer.phone}</span>
                </p>
                {customer.segment && (
                  <Badge variant="secondary" className="mt-1 h-5 px-1.5 text-[10px] capitalize">
                    {String(customer.segment).replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              {showMembershipColumns && (() => { const sub = subscriptionSummaries[String(customer.id)]; return <div className="hidden xl:grid min-w-[430px] grid-cols-4 gap-3 text-xs"><span><Badge variant={sub?.status === "active" ? "default" : "secondary"}>{sub?.status === "active" ? "Actif" : sub ? "Expiré" : "Aucun"}</Badge></span><span className="truncate">{sub?.planName || "—"}</span><span>{sub?.renewalDate || sub?.expiryDate || "—"}</span><span>{sub?.remainingKg != null ? `${sub.remainingKg} kg` : sub?.remainingPieces != null ? `${sub.remainingPieces} pcs` : sub?.remainingOrders != null ? `${sub.remainingOrders} cmd` : "—"}</span></div>; })()}

              {/* Email - hidden on small screens */}
              {customer.email ? (
                <p className="hidden md:flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-[180px]">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </p>
              ) : (
                <span className="hidden md:block w-[180px]" />
              )}

              {/* Address - hidden on small screens */}
              {customer.address ? (
                <p className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-[200px]">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{customer.address}</span>
                </p>
              ) : (
                <span className="hidden lg:block w-[200px]" />
              )}

              <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-border rounded-lg text-center">
          <div className="bg-muted rounded-full p-3">
            <UserX className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{t("no_customers_found")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("clients_subtitle")}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("add_customer")}
          </Button>
        </div>
      )}
    </div>
  );
}

function CustomerForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const { mutate, isPending } = useCreateCustomer();

  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: { name: "", phone: "", email: "", address: "", notes: "" },
  });

  function onSubmit(data: InsertCustomer) {
    mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      },
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
              <FormLabel>{t("full_name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("customer_name_placeholder")} {...field} />
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
                  <Input placeholder={t("phone_placeholder")} {...field} />
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
                <FormLabel>{t("email_optional")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("customer_email_placeholder")} {...field} value={field.value || ""} />
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
                <Input placeholder={t("customer_address_placeholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full mt-2" disabled={isPending}>
          {isPending ? t("saving") : t("create_customer")}
        </Button>
      </form>
    </Form>
  );
}
