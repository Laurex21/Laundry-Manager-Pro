import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { z } from "zod";
import {
  ChevronLeft, ChevronRight, Download, Pencil, Plus, Search,
  Trash2, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { insertExpenditureSchema, type Expenditure } from "@shared/schema";
import { useCreateExpenditure, useExpenditures } from "@/hooks/use-expenditures";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest } from "@/lib/queryClient";
import {
  EXPENSE_CATEGORIES, expenseCategoryConfig, normalizeExpenseCategory,
} from "@/lib/expense-categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftPeriod(period: string, offset: number) {
  const [year, month] = period.split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function expensePeriod(expense: Expenditure) {
  const date = new Date(expense.date || 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function Expenses() {
  const { data: expenditures = [], isLoading } = useExpenditures();
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const queryClient = useQueryClient();
  const symbol = getSymbol();
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expenditure | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<Expenditure | null>(null);
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [period, category, debouncedSearch]);

  const periodExpenses = useMemo(
    () => expenditures.filter((expense) => expensePeriod(expense) === period),
    [expenditures, period],
  );
  const previousPeriodExpenses = useMemo(
    () => expenditures.filter((expense) => expensePeriod(expense) === shiftPeriod(period, -1)),
    [expenditures, period],
  );
  const filteredExpenses = useMemo(() => periodExpenses.filter((expense) => {
    const matchesCategory = category === "all" || normalizeExpenseCategory(expense.category) === category;
    const searchable = `${expense.description || ""} ${expense.category || ""}`.toLocaleLowerCase();
    return matchesCategory && (!debouncedSearch || searchable.includes(debouncedSearch));
  }), [periodExpenses, category, debouncedSearch]);

  const periodTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const previousFilteredExpenses = previousPeriodExpenses.filter((expense) => {
    const matchesCategory = category === "all" || normalizeExpenseCategory(expense.category) === category;
    const searchable = `${expense.description || ""} ${expense.category || ""}`.toLocaleLowerCase();
    return matchesCategory && (!debouncedSearch || searchable.includes(debouncedSearch));
  });
  const previousPeriodTotal = previousFilteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const delta = previousPeriodTotal > 0
    ? Math.round(((periodTotal - previousPeriodTotal) / previousPeriodTotal) * 100)
    : null;
  const breakdown = useMemo(() => EXPENSE_CATEGORIES.map((config) => {
    const total = filteredExpenses
      .filter((expense) => normalizeExpenseCategory(expense.category) === config.value)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { ...config, total, percentage: periodTotal > 0 ? Math.round((total / periodTotal) * 100) : 0 };
  }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total), [filteredExpenses, periodTotal]);
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const visibleExpenses = filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expenditures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenditures"] });
      setDeleteExpense(null);
    },
  });

  function categoryLabel(value?: string | null) {
    return t(expenseCategoryConfig(value).labelKey);
  }

  function formatAmount(value: number) {
    return value.toLocaleString(i18n.language, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function exportCsv() {
    const rows = [
      [t("date"), t("category"), t("description"), `${t("amount")} (${symbol})`],
      ...filteredExpenses.map((expense) => [
        format(new Date(expense.date || 0), "yyyy-MM-dd"),
        categoryLabel(expense.category),
        expense.description || "",
        Number(expense.amount).toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `depenses_${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-fade-in space-y-5" aria-labelledby="expenses-heading">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="expenses-heading" className="text-2xl font-display font-bold sm:text-3xl" data-testid="text-expenses-title">
            {t("expenses")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("expenses_subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditingExpense(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20" data-testid="button-log-expense">
              <Plus className="h-4 w-4" aria-hidden="true" />{t("log_expense")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{editingExpense ? t("edit_expense") : t("log_new_expense")}</DialogTitle>
            </DialogHeader>
            <ExpenseForm expense={editingExpense} onSuccess={() => { setOpen(false); setEditingExpense(null); }} />
          </DialogContent>
        </Dialog>
      </header>

      <section className="rounded-xl border bg-card p-3 sm:p-4" aria-label={t("filters")}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <PeriodSelector value={period} onChange={setPeriod} />
          <div className="relative w-full xl:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search_expense_placeholder")} className="h-9 pl-9 pr-9" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("clear_search")}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1" data-testid="expense-filter-tabs">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("category")}</span>
          <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>{t("all")}</CategoryChip>
          {EXPENSE_CATEGORIES.map((item) => (
            <CategoryChip key={item.value} active={category === item.value} onClick={() => setCategory(item.value)}>{t(item.labelKey)}</CategoryChip>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0" aria-labelledby="expense-history-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="expense-history-heading" className="text-sm font-semibold">{t("expense_history")}</h2>
            <span className="text-xs text-muted-foreground">{filteredExpenses.length} {t("entries")}</span>
          </div>
          <ExpenseTable
            expenses={visibleExpenses}
            loading={isLoading}
            symbol={symbol}
            language={i18n.language}
            categoryLabel={categoryLabel}
            onEdit={(expense) => { setEditingExpense(expense); setOpen(true); }}
            onDelete={setDeleteExpense}
          />
          {totalPages > 1 && (
            <nav className="mt-3 flex items-center justify-between" aria-label={t("pagination")}>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("previous")}</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t("next")}</Button>
            </nav>
          )}
        </section>

        <aside className="space-y-4 xl:border-l xl:pl-5" aria-label={t("spending_breakdown")}>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("period_spending")}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-destructive">{formatAmount(periodTotal)} {symbol}</p>
            {delta !== null && (
              <div className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", delta > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                {delta > 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                <span>{delta > 0 ? "+" : ""}{delta}% {t("vs_previous_month")}</span>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{t("based_on_filter")}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("spending_breakdown")}</h2>
            {breakdown.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t("no_data_for_period")}</p> : (
              <div className="mt-4 space-y-4">
                {breakdown.slice(0, 5).map((item) => (
                  <div key={item.value}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{t(item.labelKey)}</span></span>
                      <span className="shrink-0 font-medium tabular-nums">{formatAmount(item.total)} {symbol} · {item.percentage}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${t(item.labelKey)} ${item.percentage}%`} aria-valuenow={item.percentage} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportCsv} disabled={filteredExpenses.length === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />{t("export_csv")}
          </Button>
        </aside>
      </div>

      <AlertDialog open={!!deleteExpense} onOpenChange={(value) => { if (!value) setDeleteExpense(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_expense")}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete_expense_confirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteExpense && deleteMutation.mutate(deleteExpense.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(
      "min-h-9 shrink-0 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/75 hover:text-foreground",
    )}>{children}</button>
  );
}

function PeriodSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t, i18n } = useTranslation();
  const current = getCurrentPeriod();
  const previous = shiftPeriod(current, -1);
  const [year, month] = value.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-9 items-center rounded-lg border bg-background px-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(shiftPeriod(value, -1))} aria-label={t("previous_month")}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
        <span className="min-w-[132px] px-2 text-center text-sm font-medium capitalize">{label}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(shiftPeriod(value, 1))} disabled={value >= current} aria-label={t("next_month")}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      <Button variant={value === current ? "default" : "outline"} size="sm" className="h-9" onClick={() => onChange(current)}>{t("this_month")}</Button>
      <Button variant={value === previous ? "default" : "outline"} size="sm" className="h-9" onClick={() => onChange(previous)}>{t("last_month")}</Button>
    </div>
  );
}

function ExpenseTable({ expenses, loading, symbol, language, categoryLabel, onEdit, onDelete }: {
  expenses: Expenditure[]; loading: boolean; symbol: string; language: string;
  categoryLabel: (value?: string | null) => string;
  onEdit: (expense: Expenditure) => void; onDelete: (expense: Expenditure) => void;
}) {
  const { t } = useTranslation();
  if (loading) return <div className="space-y-2 rounded-xl border p-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
  if (expenses.length === 0) return <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">{t("no_data_for_period")}</div>;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden grid-cols-[minmax(180px,1fr)_140px_90px_170px] border-b bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
        <span>{t("description")}</span><span className="text-center">{t("category")}</span><span className="text-right">{t("date")}</span><span className="text-right">{t("amount")}</span>
      </div>
      {expenses.map((expense, index) => {
        const config = expenseCategoryConfig(expense.category);
        return (
          <article key={expense.id} className={cn("group grid gap-2 border-b px-4 py-3 last:border-0 hover:bg-muted/30 md:grid-cols-[minmax(180px,1fr)_140px_90px_170px] md:items-center", index % 2 === 1 && "bg-muted/15")} data-testid={`row-expense-${expense.id}`}>
            <p className="min-w-0 truncate text-sm font-medium">{expense.description}</p>
            <div className="md:text-center"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", config.badge)}>{categoryLabel(expense.category)}</span></div>
            <time className="text-xs text-muted-foreground md:text-right" dateTime={expense.date ? new Date(expense.date).toISOString() : undefined}>{new Date(expense.date || 0).toLocaleDateString(language, { day: "numeric", month: "short" })}</time>
            <div className="flex items-center justify-between gap-2 md:justify-end">
              <span className="text-sm font-semibold tabular-nums text-destructive">−{Number(expense.amount).toLocaleString(language, { maximumFractionDigits: 2 })} {symbol}</span>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit(expense)} aria-label={t("edit")} data-testid={`button-edit-expense-${expense.id}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => onDelete(expense)} aria-label={t("delete")} data-testid={`button-delete-expense-${expense.id}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const expenseFormSchema = insertExpenditureSchema.extend({ date: z.string().optional() });
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function ExpenseForm({ onSuccess, expense }: { onSuccess: () => void; expense?: Expenditure | null }) {
  const { t } = useTranslation();
  const { mutate: createMutate, isPending: createPending } = useCreateExpenditure();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const isEdit = !!expense;
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: expense?.amount || "0",
      category: normalizeExpenseCategory(expense?.category),
      description: expense?.description || "",
      date: expense?.date ? format(new Date(expense.date), "yyyy-MM-dd") : today,
    },
    values: expense ? {
      amount: expense.amount,
      category: normalizeExpenseCategory(expense.category),
      description: expense.description,
      date: expense.date ? format(new Date(expense.date), "yyyy-MM-dd") : today,
    } : undefined,
  });
  const editMutation = useMutation({
    mutationFn: (data: ExpenseFormValues) => apiRequest("PATCH", `/api/expenditures/${expense!.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/expenditures"] }); onSuccess(); },
  });
  const isPending = createPending || editMutation.isPending;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => isEdit ? editMutation.mutate(data) : createMutate(data as any, { onSuccess }))} className="space-y-4 pt-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>{t("amount")}</FormLabel><FormControl><Input type="number" min="0" step="0.01" inputMode="decimal" {...field} value={String(field.value)} data-testid="input-expense-amount" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="date" render={({ field }) => <FormItem><FormLabel>{t("date")}</FormLabel><FormControl><Input type="date" {...field} data-testid="input-expense-date" /></FormControl><FormMessage /></FormItem>} />
        </div>
        <FormField control={form.control} name="category" render={({ field }) => <FormItem><FormLabel>{t("category")}</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-expense-category"><SelectValue placeholder={t("select_category")} /></SelectTrigger></FormControl><SelectContent>{EXPENSE_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{t(item.labelKey)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>{t("description")}</FormLabel><FormControl><Textarea placeholder={t("expense_description_placeholder")} className="min-h-24 resize-none" {...field} data-testid="input-expense-description" /></FormControl><FormMessage /></FormItem>} />
        <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-expense">{isPending ? t("saving") : isEdit ? t("update_expense") : t("record_expense")}</Button>
      </form>
    </Form>
  );
}
