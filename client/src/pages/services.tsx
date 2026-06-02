import { useState, useRef, useEffect, useMemo } from "react";
import { useServices, useCreateService, useUpdateService, useDeleteService } from "@/hooks/use-services";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceSchema, type InsertService, type Service } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import {
  Plus,
  Zap,
  Clock,
  Check,
  ChevronsUpDown,
  Pencil,
  Trash2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { labelForCategory } from "@/lib/display-labels";

const DEFAULT_CATEGORIES = ["dry_cleaning", "laundry", "pressing", "ironing", "washing"];

export default function Services() {
  const { data: services, isLoading } = useServices();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [deleteService, setDeleteService] = useState<Service | null>(null);
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { mutate: deleteMutate, isPending: isDeleting } = useDeleteService();

  const existingCategories = services
    ? Array.from(new Set(services.map((s) => s.category).filter(Boolean)))
    : [];
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCategories]));

  const grouped = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    services?.forEach((s) => {
      const cat = s.category || t("uncategorized");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [services]);

  function handleDelete() {
    if (!deleteService) return;
    deleteMutate(deleteService.id, {
      onSuccess: () => setDeleteService(null),
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">{t("services")}</h1>
          <p className="text-muted-foreground mt-1">{t("manage_services_subtitle")}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-service" className="shadow-lg shadow-primary/25">
              <Plus className="w-4 h-4 mr-2" /> {t("add_service")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("add_new_service")}</DialogTitle>
            </DialogHeader>
            <ServiceForm onSuccess={() => setCreateOpen(false)} categories={allCategories} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="h-5 w-28 rounded" />
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ))}
        </div>
      ) : !services?.length ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("add_service")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-1 pb-1 border-b">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labelForCategory(category, t)}</span>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="divide-y divide-border">
                {items.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center gap-3 py-2.5 group"
                    data-testid={`card-service-${service.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`text-service-name-${service.id}`}>
                          {service.name}
                        </span>
                        {service.expressAvailable && (
                          <Badge variant="secondary" className="text-xs py-0 h-5" data-testid={`badge-express-${service.id}`}>
                            <Zap className="w-3 h-3 mr-0.5" />
                            {t("express")}
                          </Badge>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5" data-testid={`text-service-description-${service.id}`}>
                          {service.description}
                        </p>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      {service.estimatedDuration && (
                        <span className="flex items-center gap-1" data-testid={`text-duration-${service.id}`}>
                          <Clock className="w-3 h-3" />
                          {service.estimatedDuration} {service.durationUnit === "days" ? t("days") : t("hours")}
                        </span>
                      )}
                      {service.minimumCharge && service.unit === "kg" && (
                        <span data-testid={`text-min-charge-${service.id}`}>
                          {t("min")}: {symbol}{Number(service.minimumCharge).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-sm text-primary" data-testid={`text-service-price-${service.id}`}>
                        {symbol}{Number(service.price).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1" data-testid={`text-service-category-${service.id}`}>
                        / {service.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditService(service)}
                        data-testid={`button-edit-service-${service.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteService(service)}
                        data-testid={`button-delete-service-${service.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editService} onOpenChange={(open) => { if (!open) setEditService(null); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit_service")}</DialogTitle>
          </DialogHeader>
          {editService && (
            <ServiceForm
              key={editService.id}
              service={editService}
              onSuccess={() => setEditService(null)}
              categories={allCategories}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteService} onOpenChange={(open) => { if (!open) setDeleteService(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_service_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_service_confirm", { name: deleteService?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={isDeleting}
              data-testid="button-confirm-delete"
            >
              {isDeleting ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreatableCategorySelect({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (val: string) => void;
  categories: string[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = categories.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );
  const showCreate =
    search.trim() !== "" &&
    !categories.some((c) => c.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="select-category"
        >
          {value ? labelForCategory(value, t) : t("select_category")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder={t("search_or_create_category")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-category-search"
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.map((cat) => (
            <button
              key={cat}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover-elevate cursor-pointer"
              onClick={() => {
                onChange(cat);
                setOpen(false);
                setSearch("");
              }}
              data-testid={`option-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value === cat && <Check className="w-3 h-3 text-primary" />}
              <span className={value === cat ? "font-medium" : ""}>{labelForCategory(cat, t)}</span>
            </button>
          ))}
          {showCreate && (
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover-elevate cursor-pointer text-primary"
              onClick={() => {
                onChange(search.trim());
                setOpen(false);
                setSearch("");
              }}
              data-testid="button-create-category"
            >
              <Plus className="w-3 h-3" />
              {t("create_category")}: "{search.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground text-center py-2">{t("no_results")}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ServiceForm({ onSuccess, categories, service }: { onSuccess: () => void; categories: string[]; service?: Service }) {
  const { mutate: createMutate, isPending: isCreating } = useCreateService();
  const { mutate: updateMutate, isPending: isUpdating } = useUpdateService();
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const isEditing = !!service;
  const isPending = isCreating || isUpdating;

  const form = useForm<InsertService>({
    resolver: zodResolver(insertServiceSchema),
    defaultValues: {
      name: service?.name || "",
      description: service?.description || "",
      unit: service?.unit || "piece",
      price: service?.price || "0",
      category: service?.category || "",
      active: service?.active ?? true,
      minimumCharge: service?.minimumCharge || undefined,
      estimatedDuration: service?.estimatedDuration || undefined,
      durationUnit: service?.durationUnit || "hours",
      expressAvailable: service?.expressAvailable ?? false,
      expressSurcharge: service?.expressSurcharge || undefined,
    },
  });

  const unitValue = useWatch({ control: form.control, name: "unit" });
  const expressAvailable = useWatch({ control: form.control, name: "expressAvailable" });

  function onSubmit(data: InsertService) {
    const payload: any = { ...data };
    if (data.unit !== "kg" || !data.minimumCharge) delete payload.minimumCharge;
    if (!data.expressAvailable || !data.expressSurcharge) delete payload.expressSurcharge;
    if (!data.estimatedDuration) {
      delete payload.estimatedDuration;
      delete payload.durationUnit;
    }

    if (isEditing) {
      updateMutate({ id: service.id, ...payload } as any, {
        onSuccess: () => {
          onSuccess();
        },
      });
    } else {
      createMutate(payload as InsertService, {
        onSuccess: () => {
          form.reset();
          onSuccess();
        },
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("service_name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("service_name_placeholder")} {...field} data-testid="input-service-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("description")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("service_description_placeholder")}
                  className="resize-none"
                  rows={2}
                  {...field}
                  value={field.value || ""}
                  data-testid="textarea-service-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("price")} ({symbol})</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value.toString()} data-testid="input-service-price" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("unit")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-unit">
                      <SelectValue placeholder={t("select_unit")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="piece">{t("unit_piece")}</SelectItem>
                    <SelectItem value="kg">{t("unit_kg")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {unitValue === "kg" && (
          <FormField
            control={form.control}
            name="minimumCharge"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("minimum_charge")} ({symbol})</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t("minimum_charge_placeholder")}
                    {...field}
                    value={field.value?.toString() || ""}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    data-testid="input-minimum-charge"
                  />
                </FormControl>
                <FormDescription>{t("minimum_charge_hint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category")}</FormLabel>
              <FormControl>
                <CreatableCategorySelect
                  value={field.value}
                  onChange={field.onChange}
                  categories={categories}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="estimatedDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("estimated_duration")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    placeholder={t("duration_placeholder")}
                    {...field}
                    value={field.value?.toString() || ""}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    data-testid="input-estimated-duration"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="durationUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("duration_unit")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "hours"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-duration-unit">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hours">{t("hours")}</SelectItem>
                    <SelectItem value="days">{t("days")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border rounded-md p-4 space-y-3">
          <FormField
            control={form.control}
            name="expressAvailable"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-express-available"
                  />
                </FormControl>
                <div>
                  <FormLabel className="cursor-pointer">{t("express_service_available")}</FormLabel>
                </div>
              </FormItem>
            )}
          />
          {expressAvailable && (
            <FormField
              control={form.control}
              name="expressSurcharge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("express_surcharge")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder={t("surcharge_placeholder")}
                      {...field}
                      value={field.value?.toString() || ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                      data-testid="input-express-surcharge"
                    />
                  </FormControl>
                  <FormDescription>{t("express_surcharge_hint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={isPending} data-testid="button-save-service">
          {isPending ? t("saving") : isEditing ? t("update_service") : t("save_service")}
        </Button>
      </form>
    </Form>
  );
}
