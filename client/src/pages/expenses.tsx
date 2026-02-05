import { useState } from "react";
import { useExpenditures, useCreateExpenditure } from "@/hooks/use-expenditures";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenditureSchema, type InsertExpenditure } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { 
  Plus, 
  DollarSign,
  TrendingDown,
  Calendar
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
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

export default function Expenses() {
  const { data: expenditures, isLoading } = useExpenditures();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const totalExpenses = expenditures?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('expenses')}</h1>
          <p className="text-muted-foreground mt-1">Track business expenses and costs</p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4">Expense History</h3>
            {isLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : expenditures?.length === 0 ? (
              <div className="text-muted-foreground">No expenses recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {expenditures?.map((item) => (
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
                      <p className="font-mono font-medium text-orange-600">-${Number(item.amount).toFixed(2)}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(item.date!), "MMM d")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total Expenses</span>
                <TrendingDown className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className="text-3xl font-display font-bold text-orange-900">${totalExpenses.toFixed(2)}</h2>
              <p className="text-xs text-muted-foreground mt-2">All time spending</p>
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
