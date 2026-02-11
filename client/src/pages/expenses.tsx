import { useState, useMemo } from "react";
import { useExpenditures, useCreateExpenditure } from "@/hooks/use-expenditures";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenditureSchema, type InsertExpenditure } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { 
  Plus, 
  DollarSign,
  TrendingDown,
  Calendar,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, isWithinInterval, startOfYear } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";

const COLORS = ["#3b82f6", "#f97316", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export default function Expenses() {
  const { data: expenditures, isLoading } = useExpenditures();
  const [open, setOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const filteredExpenditures = useMemo(() => {
    if (!expenditures) return [];
    const now = new Date();
    return expenditures.filter((exp) => {
      const expDate = new Date(exp.date!);
      if (dateFilter === "7days") return isWithinInterval(expDate, { start: subDays(now, 7), end: now });
      if (dateFilter === "30days") return isWithinInterval(expDate, { start: subDays(now, 30), end: now });
      if (dateFilter === "thisYear") return isWithinInterval(expDate, { start: startOfYear(now), end: now });
      return true;
    });
  }, [expenditures, dateFilter]);

  const chartData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredExpenditures.forEach((exp) => {
      categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount);
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [filteredExpenditures]);

  const totalFilteredExpenses = filteredExpenditures.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalAllExpenses = expenditures?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('expenses')}</h1>
          <p className="text-muted-foreground mt-1">Track business expenses and costs</p>
        </div>
        <div className="flex gap-3">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] bg-background border-border">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                <Plus className="w-4 h-4 mr-2" /> {t('log_expense')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Log New Expense</DialogTitle>
              </DialogHeader>
              <ExpenseForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Expense History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : filteredExpenditures.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                No expenses recorded for this period.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredExpenditures.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-transparent hover:border-border transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{item.category}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium text-orange-600">-{symbol}{Number(item.amount).toFixed(2)}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(item.date!), "MMM d, yyyy")}
                      </div>
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
              <h2 className="text-3xl font-display font-bold text-orange-900 dark:text-orange-400">{symbol}{totalFilteredExpenses.toFixed(2)}</h2>
              <p className="text-xs text-muted-foreground mt-2">Based on current filter</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Spending Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center p-0">
              {totalFilteredExpenses === 0 ? (
                <div className="text-center p-6 text-muted-foreground flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <DollarSign className="w-6 h-6 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">No expenses recorded</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${symbol}${value.toFixed(2)}`, 'Amount']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      align="center"
                      layout="horizontal"
                      iconType="circle"
                    />
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

function ExpenseForm({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateExpenditure();
  
  const form = useForm<InsertExpenditure>({
    resolver: zodResolver(insertExpenditureSchema),
    defaultValues: {
      amount: "0",
      category: "Supplies",
      description: ""
    }
  });

  function onSubmit(data: InsertExpenditure) {
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value.toString()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Supplies">Supplies</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Details about this expense..." className="resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full mt-2" disabled={isPending}>
          {isPending ? "Recording..." : "Record Expense"}
        </Button>
      </form>
    </Form>
  );
}
