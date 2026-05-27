import { useState, useMemo } from "react";
import { useExpenditures, useCreateExpenditure } from "@/hooks/use-expenditures";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenditureSchema, type Expenditure } from "@shared/schema";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, DollarSign, TrendingDown, Calendar, Filter, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays, isWithinInterval, startOfYear } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ["#3b82f6", "#f97316", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

const EXPENSE_TYPE_KEYS = [
  { key: "water", labelKey: "cat_water", color: "bg-blue-100 text-blue-700" },
  { key: "electricity", labelKey: "cat_electricity", color: "bg-yellow-100 text-yellow-700" },
  { key: "detergent", labelKey: "cat_detergent", color: "bg-purple-100 text-purple-700" },
  { key: "rent", labelKey: "cat_rent", color: "bg-orange-100 text-orange-700" },
  { key: "salary", labelKey: "cat_salary", color: "bg-green-100 text-green-700" },
  { key: "other", labelKey: "cat_other", color: "bg-gray-100 text-gray-700" },
];

export default function Expenses() {
  const { data: expenditures, isLoading } = useExpenditures();
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expenditure | null>(null);
  const [dateFilter, setDateFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const filteredExpenditures = useMemo(() => {
    if (!expenditures) return [];
    const now = new Date();
    return expenditures.filter((exp) => {
      const expDate = new Date(exp.date!);
      if (dateFilter === "7days" && !isWithinInterval(expDate, { start: subDays(now, 7), end: now })) return false;
      if (dateFilter === "30days" && !isWithinInterval(expDate, { start: subDays(now, 30), end: now })) return false;
      if (dateFilter === "thisYear" && !isWithinInterval(expDate, { start: startOfYear(now), end: now })) return false;
      if (typeFilter !== "all" && exp.category.toLowerCase() !== typeFilter) return false;
      return true;
    });
  }, [expenditures, dateFilter, typeFilter]);

  const typeBreakdown = useMemo(() => {
    if (!expenditures) return [];
    const map: Record<string, number> = {};
    expenditures.forEach(exp => {
      const key = exp.category.toLowerCase();
      map[key] = (map[key] || 0) + Number(exp.amount);
    });
    return Object.entries(map).map(([key, total]) => ({ key, total }));
  }, [expenditures]);

  const chartData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredExpenditures.forEach((exp) => {
      categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
  }, [filteredExpenditures]);

  const totalFilteredExpenses = filteredExpenditures.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-expenses-title">{t('expenses')}</h1>
          <p className="text-muted-foreground mt-1">{t("expenses_subtitle")}</p>
        </div>
        <div className="flex gap-3">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] bg-background border-border" data-testid="select-date-filter">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder={t("filter_by_date")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_time")}</SelectItem>
              <SelectItem value="7days">{t("last_7_days")}</SelectItem>
              <SelectItem value="30days">{t("last_30_days")}</SelectItem>
              <SelectItem value="thisYear">{t("this_year")}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingExpense(null); }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all" data-testid="button-log-expense">
                <Plus className="w-4 h-4 mr-2" /> {t('log_expense')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingExpense ? t("edit_expense") : t("log_new_expense")}</DialogTitle>
              </DialogHeader>
              <ExpenseForm onSuccess={() => { setOpen(false); setEditingExpense(null); }} expense={editingExpense} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {typeBreakdown.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="expense-type-breakdown">
          {typeBreakdown.map(({ key, total }) => {
            const typeInfo = EXPENSE_TYPE_KEYS.find(et => et.key === key) || EXPENSE_TYPE_KEYS[5];
            return (
              <Card key={key} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter(typeFilter === key ? "all" : key)} data-testid={`card-type-${key}`}>
                <CardContent className="p-3 text-center">
                  <Badge className={typeInfo.color} variant="secondary">{t(typeInfo.labelKey)}</Badge>
                  <p className="font-bold mt-2">{symbol}{total.toFixed(0)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 flex-wrap" data-testid="expense-filter-tabs">
        <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}
          className={typeFilter === "all" ? "bg-primary text-white" : ""} data-testid="filter-tab-all">
          {t("all")}
        </Button>
        {EXPENSE_TYPE_KEYS.map(et => (
          <Button key={et.key} variant={typeFilter === et.key ? "default" : "outline"} size="sm"
            onClick={() => setTypeFilter(typeFilter === et.key ? "all" : et.key)}
            className={typeFilter === et.key ? "bg-primary text-white" : ""} data-testid={`filter-tab-${et.key}`}>
            {t(et.labelKey)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader><CardTitle className="text-lg font-bold">Expense History</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : filteredExpenditures.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">No expenses recorded for this period.</div>
            ) : (
              <div className="space-y-4">
                {filteredExpenditures.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-transparent hover:border-border transition-colors" data-testid={`row-expense-${item.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="bg-orange-100 text-orange-600 p-2 rounded-lg"><DollarSign className="w-4 h-4" /></div>
                      <div>
                        <p className="font-medium">{item.category}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono font-medium text-orange-600">-{symbol}{Number(item.amount).toFixed(2)}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(item.date!), "MMM d, yyyy")}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingExpense(item); setOpen(true); }} data-testid={`button-edit-expense-${item.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/10 dark:to-card border-orange-100 dark:border-orange-900/20 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Period Spending</span>
                <TrendingDown className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-orange-900 dark:text-orange-400">{symbol}{totalFilteredExpenses.toFixed(2)}</h2>
              <p className="text-xs text-muted-foreground mt-2">Based on current filter</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-lg font-bold">Spending Breakdown</CardTitle></CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center p-0">
              {totalFilteredExpenses === 0 ? (
                <div className="text-center p-6 text-muted-foreground flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><DollarSign className="w-6 h-6 opacity-20" /></div>
                  <p className="text-sm font-medium">No expenses recorded</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${symbol}${value.toFixed(2)}`, 'Amount']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" align="center" layout="horizontal" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const expenseFormSchema = insertExpenditureSchema.extend({
  date: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function ExpenseForm({ onSuccess, expense }: { onSuccess: () => void; expense?: Expenditure | null }) {
  const { t } = useTranslation();
  const { mutate: createMutate, isPending: createPending } = useCreateExpenditure();
  const queryClient = useQueryClient();
  const [customCategory, setCustomCategory] = useState(false);
  const isEdit = !!expense;

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: expense ? expense.amount : "0",
      category: expense ? expense.category : "Supplies",
      description: expense ? expense.description : "",
      date: expense?.date ? format(new Date(expense.date as any), "yyyy-MM-dd") : todayStr,
    },
    values: expense ? {
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      date: expense.date ? format(new Date(expense.date as any), "yyyy-MM-dd") : todayStr,
    } : undefined,
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/expenditures/${expense!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenditures"] });
      form.reset();
      onSuccess();
    },
  });

  function onSubmit(data: ExpenseFormValues) {
    if (isEdit) {
      editMutation.mutate(data);
    } else {
      createMutate(data as any, {
        onSuccess: () => {
          form.reset({ amount: "0", category: "Supplies", description: "", date: todayStr });
          setCustomCategory(false);
          onSuccess();
        }
      });
    }
  }

  const isPending = isEdit ? editMutation.isPending : createPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("amount")}</FormLabel>
              <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value.toString()} data-testid="input-expense-amount" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("date")}</FormLabel>
              <FormControl><Input type="date" {...field} data-testid="input-expense-date" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category")}</FormLabel>
              {customCategory ? (
                <div className="flex gap-2">
                  <FormControl><Input placeholder={t("enter_category")} {...field} autoFocus data-testid="input-expense-category-custom" /></FormControl>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomCategory(false); field.onChange("Supplies"); }}>{t("cancel")}</Button>
                </div>
              ) : (
                <Select onValueChange={(value) => { if (value === "custom") { setCustomCategory(true); field.onChange(""); } else { field.onChange(value); }}} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-expense-category"><SelectValue placeholder={t("select_category_placeholder")} /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Supplies">{t("cat_supplies")}</SelectItem>
                    <SelectItem value="Water">{t("cat_water")}</SelectItem>
                    <SelectItem value="Electricity">{t("cat_electricity")}</SelectItem>
                    <SelectItem value="Detergent">{t("cat_detergent")}</SelectItem>
                    <SelectItem value="Rent">{t("cat_rent")}</SelectItem>
                    <SelectItem value="Salary">{t("cat_salary")}</SelectItem>
                    <SelectItem value="Utilities">{t("cat_utilities")}</SelectItem>
                    <SelectItem value="Maintenance">{t("cat_maintenance")}</SelectItem>
                    <SelectItem value="Transportation">{t("cat_transportation")}</SelectItem>
                    <SelectItem value="Other">{t("cat_other")}</SelectItem>
                    <SelectItem value="custom">{t("add_new_category")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("description")}</FormLabel>
            <FormControl><Textarea placeholder={t("expenses_subtitle")} className="resize-none" {...field} data-testid="input-expense-description" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full mt-2" disabled={isPending} data-testid="button-save-expense">
          {isPending ? t("saving") : isEdit ? t("update_expense") : t("record_expense")}
        </Button>
      </form>
    </Form>
  );
}
