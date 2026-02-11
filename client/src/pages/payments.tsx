import { useState, useMemo, useCallback } from "react";
import { useOrders } from "@/hooks/use-orders";
import { usePaymentsByOrder, useCreatePayment } from "@/hooks/use-payments";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import {
  CreditCard,
  CheckCircle2,
  Search,
  Download,
  Receipt,
  Banknote,
  Smartphone,
  Building2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

export default function Payments() {
  const { data: allOrders, isLoading: ordersLoading } = useOrders();
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [successPayment, setSuccessPayment] = useState<{
    orderId: number;
    amount: string;
    method: string;
    date: string;
    customerName: string;
    totalAmount: string;
    newStatus: string;
  } | null>(null);

  const { data: orderPayments } = usePaymentsByOrder(selectedOrderId || 0);
  const { mutate: createPayment, isPending } = useCreatePayment();

  const orders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter((o: any) => o.paymentStatus !== "paid");
  }, [allOrders]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId || !allOrders) return null;
    return allOrders.find((o: any) => o.id === selectedOrderId) || null;
  }, [selectedOrderId, allOrders]);

  const totalPaid = useMemo(() => {
    if (!orderPayments) return 0;
    return orderPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  }, [orderPayments]);

  const totalAmount = selectedOrder ? Number(selectedOrder.totalAmount) : 0;
  const remainingBalance = Math.max(0, totalAmount - totalPaid);

  const handleSelectOrder = useCallback((orderId: number) => {
    setSelectedOrderId(orderId);
    setOrderSearchOpen(false);
    setAmount("");
    setSuccessPayment(null);
  }, []);

  const handleAmountSet = useCallback(() => {
    if (remainingBalance > 0) {
      setAmount(remainingBalance.toFixed(2));
    }
  }, [remainingBalance]);

  const amountError = useMemo(() => {
    const val = Number(amount);
    if (amount && val <= 0) return "Amount must be greater than zero";
    if (amount && val > remainingBalance) return "Amount exceeds remaining balance";
    return null;
  }, [amount, remainingBalance]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || amountError || !amount) return;

    const paidAmount = Number(amount);
    const newTotalPaid = totalPaid + paidAmount;
    const newStatus = newTotalPaid >= totalAmount ? "paid" : "partial";

    createPayment(
      { orderId: selectedOrderId, amount: amount, method },
      {
        onSuccess: () => {
          setSuccessPayment({
            orderId: selectedOrderId,
            amount: paidAmount.toFixed(2),
            method,
            date: paymentDate,
            customerName: (selectedOrder as any)?.customer?.name || `Order #${selectedOrderId}`,
            totalAmount: totalAmount.toFixed(2),
            newStatus,
          });
          setAmount("");
          setSelectedOrderId(null);
        },
      }
    );
  }

  function downloadReceipt() {
    if (!successPayment) return;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - CleanEase</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f8f9fa; padding: 40px; }
    .receipt { max-width: 400px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: #2563eb; color: white; padding: 24px; text-align: center; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p { font-size: 12px; opacity: 0.8; }
    .body { padding: 24px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b7280; }
    .value { font-weight: 600; color: #1f2937; }
    .total { font-size: 18px; color: #2563eb; }
    .footer { text-align: center; padding: 16px; background: #f9fafb; font-size: 11px; color: #9ca3af; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .status-paid { background: #dcfce7; color: #16a34a; }
    .status-partial { background: #fef3c7; color: #d97706; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>CleanEase</h1>
      <p>Laundry Management - Payment Receipt</p>
    </div>
    <div class="body">
      <div class="row"><span class="label">Receipt Date</span><span class="value">${successPayment.date}</span></div>
      <div class="row"><span class="label">Order ID</span><span class="value">#${successPayment.orderId}</span></div>
      <div class="row"><span class="label">Customer</span><span class="value">${successPayment.customerName}</span></div>
      <div class="row"><span class="label">Order Total</span><span class="value">${symbol}${successPayment.totalAmount}</span></div>
      <div class="row"><span class="label">Payment Method</span><span class="value">${successPayment.method}</span></div>
      <div class="row"><span class="label">Amount Paid</span><span class="value total">${symbol}${successPayment.amount}</span></div>
      <div class="row" style="justify-content:center; border:none; padding-top:12px;">
        <span class="status ${successPayment.newStatus === 'paid' ? 'status-paid' : 'status-partial'}">${successPayment.newStatus === 'paid' ? 'FULLY PAID' : 'PARTIALLY PAID'}</span>
      </div>
    </div>
    <div class="footer">Thank you for choosing CleanEase</div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-order-${successPayment.orderId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('payments') || 'Payments'}</h1>
          <p className="text-muted-foreground mt-1">Record and manage order payments</p>
        </div>
      </div>

      {successPayment && (
        <Card className="border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/10 shadow-sm" data-testid="payment-success-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-3 rounded-full">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-900 dark:text-green-300 text-lg">Payment Recorded Successfully</h3>
                <p className="text-green-700 dark:text-green-400 text-sm mt-1">
                  {symbol}{successPayment.amount} paid for Order #{successPayment.orderId} via {successPayment.method}.
                  Status: <Badge variant="outline" className={successPayment.newStatus === 'paid' ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400' : 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400'}>{successPayment.newStatus === 'paid' ? 'Fully Paid' : 'Partially Paid'}</Badge>
                </p>
              </div>
              <Button onClick={downloadReceipt} variant="outline" className="gap-2" data-testid="button-download-receipt">
                <Download className="w-4 h-4" /> Download Receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Register Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Order</label>
                <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-select-order"
                    >
                      <Search className="w-4 h-4 mr-2 text-muted-foreground" />
                      {selectedOrder
                        ? `Order #${selectedOrder.id} - ${(selectedOrder as any)?.customer?.name || 'Customer'}`
                        : "Search for an order..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by order ID or customer..." />
                      <CommandList>
                        <CommandEmpty>No unpaid orders found.</CommandEmpty>
                        <CommandGroup heading="Unpaid / Partially Paid Orders">
                          {orders.map((order: any) => (
                            <CommandItem
                              key={order.id}
                              value={`${order.id} ${order.customer?.name || ''}`}
                              onSelect={() => handleSelectOrder(order.id)}
                              data-testid={`order-option-${order.id}`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col">
                                  <span className="font-medium">Order #{order.id}</span>
                                  <span className="text-xs text-muted-foreground">{order.customer?.name || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {order.paymentStatus}
                                  </Badge>
                                  <span className="font-mono text-sm">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedOrder && (
                <>
                  <Card className="bg-muted/30 border-border/50">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Order Total</p>
                          <p className="font-mono font-bold text-lg" data-testid="text-order-total">{symbol}{totalAmount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Amount Paid</p>
                          <p className="font-mono font-bold text-lg text-green-600 dark:text-green-400" data-testid="text-amount-paid">{symbol}{totalPaid.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                          <p className="font-mono font-bold text-lg text-orange-600 dark:text-orange-400" data-testid="text-remaining-balance">{symbol}{remainingBalance.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount</label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remainingBalance}
                          placeholder={remainingBalance.toFixed(2)}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onFocus={() => { if (!amount) handleAmountSet(); }}
                          className={amountError ? "border-destructive" : ""}
                          data-testid="input-amount"
                        />
                      </div>
                      {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment Method</label>
                      <Select value={method} onValueChange={setMethod}>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">
                            <span className="flex items-center gap-2"><Banknote className="w-4 h-4" /> Cash</span>
                          </SelectItem>
                          <SelectItem value="Bank Transfer">
                            <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Bank Transfer</span>
                          </SelectItem>
                          <SelectItem value="Mobile Money">
                            <span className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Mobile Money</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date</label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        data-testid="input-payment-date"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full shadow-lg shadow-primary/25"
                    disabled={isPending || !amount || !!amountError}
                    data-testid="button-submit-payment"
                  >
                    {isPending ? "Processing..." : `Record Payment of ${symbol}${amount || '0.00'}`}
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/10 dark:to-card border-blue-100 dark:border-blue-900/20 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Quick Guide</span>
                <Receipt className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-3 mt-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <p className="text-sm text-muted-foreground">Search and select an unpaid order</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <p className="text-sm text-muted-foreground">Review the balance and enter payment amount</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <p className="text-sm text-muted-foreground">Choose payment method and submit</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                  <p className="text-sm text-muted-foreground">Download the receipt for your records</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedOrder && orderPayments && orderPayments.length > 0 && (
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {orderPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{p.method}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-green-600 dark:text-green-400">{symbol}{Number(p.amount).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(p.date), "MMM d")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
