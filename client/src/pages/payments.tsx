import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrders } from "@/hooks/use-orders";
import { usePaymentsByOrder, useCreatePayment } from "@/hooks/use-payments";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { PAYMENT_METHODS, PAYMENT_REGIONS, getMethodDef } from "@/lib/payment-methods";
import { generatePaymentReceipt } from "@/lib/receipt";
import { DEFAULT_SETTINGS } from "@/lib/receipt-settings";
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
  const { data: settings } = useQuery<any>({ queryKey: ["/api/settings"] });

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
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
      { orderId: selectedOrderId, amount: amount, method, reference: reference || undefined },
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
          setReference("");
          setSelectedOrderId(null);
        },
      }
    );
  }

  const [receiptLoading, setReceiptLoading] = useState(false);

  async function downloadReceipt() {
    if (!successPayment) return;
    setReceiptLoading(true);

    try {
    let orderDetails: any = null;
    try {
      const res = await fetch(`/api/orders/${successPayment.orderId}`, { credentials: "include" });
      if (res.ok) orderDetails = await res.json();
    } catch {
      // proceed with available data
    }

    const items = orderDetails?.items || [];
    const garments = orderDetails?.garmentItems || [];
    const customer = orderDetails?.customer || {};
    const pickupDate = orderDetails?.pickupDate
      ? format(new Date(orderDetails.pickupDate), "MMM dd, yyyy")
      : "N/A";
    const entryDate = orderDetails?.entryDate
      ? format(new Date(orderDetails.entryDate), "MMM dd, yyyy")
      : successPayment.date;

    const mergedSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
    const allPayments = orderDetails?.payments || [];
    const discount = Number(orderDetails?.discount || 0);

    generatePaymentReceipt(
      successPayment.orderId,
      customer,
      items,
      garments,
      {
        amount: successPayment.amount,
        method: successPayment.method,
        date: successPayment.date,
        newStatus: successPayment.newStatus,
      },
      allPayments,
      entryDate,
      pickupDate,
      discount,
      symbol,
      mergedSettings
    );
    } finally {
      setReceiptLoading(false);
    }
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
              <Button onClick={downloadReceipt} variant="outline" className="gap-2" disabled={receiptLoading} data-testid="button-download-receipt">
                <Download className="w-4 h-4" /> {receiptLoading ? "Preparing..." : "Download Receipt"}
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
                      <Select value={method} onValueChange={(v) => { setMethod(v); setReference(""); }}>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {PAYMENT_REGIONS.map(region => (
                            <div key={region}>
                              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{region}</div>
                              {PAYMENT_METHODS.filter(m => m.region === region).map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </div>
                          ))}
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

                  {getMethodDef(method).requiresReference && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Transaction Reference</label>
                      <Input
                        placeholder="e.g. transaction ID, receipt number..."
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        data-testid="input-reference"
                      />
                      <p className="text-xs text-muted-foreground">Enter the reference number from the {getMethodDef(method).label} transaction</p>
                    </div>
                  )}

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
                        {p.reference && <span className="text-[10px] text-muted-foreground/70">Ref: {p.reference}</span>}
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
