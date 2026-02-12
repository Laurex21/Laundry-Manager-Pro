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
    const discount = Number(orderDetails?.discount || 0);

    const itemsHtml = items.map((item: any) => {
      const svc = item.service || {};
      const qty = item.quantity;
      const unit = svc.unit === "kg" ? "Loads" : "Pieces";
      const price = Number(item.priceAtOrder);
      const lineTotal = qty * price;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${svc.name || 'Service'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty} ${unit}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${symbol}${lineTotal.toFixed(2)}</td>
      </tr>`;
    }).join("");

    const garmentHtml = garments.length > 0 ? garments.map((g: any) => {
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;">${g.quantity} x ${g.itemName}</td>
      </tr>`;
    }).join("") : `<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;">No garment items recorded</td></tr>`;

    const subtotalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.priceAtOrder) * item.quantity), 0);

    const statusLabel = successPayment.newStatus === "paid" ? "PAID" : successPayment.newStatus === "partial" ? "PARTIAL" : "UNPAID";
    const statusColor = successPayment.newStatus === "paid" ? "#16a34a" : successPayment.newStatus === "partial" ? "#d97706" : "#dc2626";
    const statusBg = successPayment.newStatus === "paid" ? "#dcfce7" : successPayment.newStatus === "partial" ? "#fef3c7" : "#fee2e2";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - Order #${successPayment.orderId}</title>
  <style>
    @media print {
      body { padding: 0; background: #fff; }
      .no-print { display: none; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; padding: 24px; color: #1e293b; }
    .receipt { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .print-btn { display: block; margin: 16px auto; padding: 10px 32px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .print-btn:hover { background: #1d4ed8; }

    .header { background: #1e3a5f; color: #fff; padding: 28px 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand h1 { font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .brand p { font-size: 12px; opacity: 0.8; margin-top: 4px; line-height: 1.5; }
    .order-id-box { text-align: right; }
    .order-id-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .order-id-box .id { font-size: 28px; font-weight: 800; margin-top: 2px; }

    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px; }
    .meta-item .value { font-size: 14px; font-weight: 600; color: #1e293b; }

    .items-section { padding: 24px 32px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .items-table thead th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .items-table thead th:nth-child(2) { text-align: center; }
    .items-table thead th:last-child { text-align: right; }
    .items-table tbody td { color: #334155; }

    .checklist-section { padding: 0 32px 24px; }
    .checklist-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .checklist-table td { color: #334155; }

    .summary { padding: 0 32px 24px; }
    .summary-box { background: #f8fafc; border-radius: 6px; padding: 16px 20px; margin-top: 8px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .summary-row.total { border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 700; color: #1e293b; }
    .summary-row .discount { color: #dc2626; }

    .payment-section { padding: 0 32px 24px; }
    .payment-box { display: flex; justify-content: space-between; align-items: center; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px 20px; }
    .payment-info { font-size: 13px; color: #334155; }
    .payment-info strong { font-size: 15px; display: block; margin-top: 2px; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }

    .terms { padding: 24px 32px; border-top: 1px solid #e2e8f0; background: #fafbfc; }
    .terms h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    .terms ol { padding-left: 18px; }
    .terms li { font-size: 10.5px; color: #64748b; line-height: 1.6; margin-bottom: 8px; }
    .terms li strong { color: #475569; }

    .footer { text-align: center; padding: 20px 32px; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 12px; color: #94a3b8; }
    .footer .thanks { font-size: 14px; font-weight: 600; color: #1e3a5f; margin-bottom: 4px; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print Receipt</button>
  <div class="receipt">
    <div class="header">
      <div class="header-top">
        <div class="brand">
          <h1>CleanEase Laundry</h1>
          <p>123 Clean Street, Laundry District<br>Phone: +1 (555) 123-4567</p>
        </div>
        <div class="order-id-box">
          <div class="label">Order No.</div>
          <div class="id">#${successPayment.orderId}</div>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="label">Customer</div>
        <div class="value">${customer.name || successPayment.customerName}</div>
      </div>
      <div class="meta-item">
        <div class="label">Order Date</div>
        <div class="value">${entryDate}</div>
      </div>
      <div class="meta-item">
        <div class="label">Receipt Date</div>
        <div class="value">${format(new Date(successPayment.date), "MMM dd, yyyy")}</div>
      </div>
      <div class="meta-item">
        <div class="label">Expected Pickup</div>
        <div class="value">${pickupDate}</div>
      </div>
    </div>

    <div class="items-section">
      <div class="section-title">Service Summary</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Service Name</th>
            <th>Qty (Loads/Pieces)</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;">No services recorded</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="checklist-section">
      <div class="section-title">Garment Checklist</div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">For inventory verification only &mdash; not billed separately.</p>
      <table class="checklist-table">
        <tbody>
          ${garmentHtml}
        </tbody>
      </table>
    </div>

    <div class="summary">
      <div class="section-title">Totals &amp; Payment</div>
      <div class="summary-box">
        <div class="summary-row"><span>Subtotal</span><span>${symbol}${subtotalAmount.toFixed(2)}</span></div>
        ${discount > 0 ? `<div class="summary-row"><span>Discount</span><span class="discount">-${symbol}${discount.toFixed(2)}</span></div>` : ""}
        <div class="summary-row total"><span>Total Amount</span><span>${symbol}${Number(successPayment.totalAmount).toFixed(2)}</span></div>
        <div class="summary-row"><span>Amount Paid (this receipt)</span><span style="color:#16a34a;font-weight:600;">${symbol}${successPayment.amount}</span></div>
      </div>
    </div>

    <div class="payment-section">
      <div class="payment-box">
        <div class="payment-info">
          Payment Method
          <strong>${successPayment.method}</strong>
        </div>
        <span class="status-badge" style="background:${statusBg};color:${statusColor};">${statusLabel}</span>
      </div>
    </div>

    <div class="terms">
      <h3>Laundry Terms & Conditions</h3>
      <ol>
        <li><strong>Liability Limit:</strong> Our liability for any lost or damaged garment shall not exceed 3 times the cleaning cost of that specific item, regardless of brand or purchase price.</li>
        <li><strong>Pocket Policy:</strong> Customers are responsible for emptying all pockets before dropping off items. We are not liable for damage caused by items left in pockets (e.g., pens, lipstick, gum) or for the loss of valuables left inside.</li>
        <li><strong>Unclaimed Items:</strong> Items not collected within 30 days of the &ldquo;Ready Date&rdquo; may be subject to a storage fee. Items left for more than 90 days will be donated to charity or disposed of.</li>
        <li><strong>Pre-existing Damage:</strong> We reserve the right to refuse service for items with significant pre-existing wear, delicate fabrics, or missing care labels. We are not responsible for buttons, zippers, or sequins that fail due to normal cleaning processes.</li>
        <li><strong>Nature of Stains:</strong> While we strive for perfection, we cannot guarantee the 100% removal of all stains. Some stains are permanent, and further treatment may risk damaging the fabric.</li>
        <li><strong>Error Reporting:</strong> Any claims regarding missing items or damage must be made within 24 hours of pickup/delivery and must be accompanied by the original receipt.</li>
      </ol>
    </div>

    <div class="footer">
      <p class="thanks">Thank you for choosing CleanEase!</p>
      <p>For inquiries, contact us at +1 (555) 123-4567</p>
    </div>
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
