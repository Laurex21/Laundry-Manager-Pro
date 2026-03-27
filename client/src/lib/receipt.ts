import { format } from "date-fns";

const PIPELINE_LABELS: Record<string, string> = {
  received: "Received",
  washing: "Washing",
  stain_treatment: "Stain Treatment",
  drying: "Drying",
  ironing: "Ironing",
  ready: "Ready for Pickup",
  delivered: "Delivered",
};

const PIPELINE_ORDER = ["received", "washing", "stain_treatment", "drying", "ironing", "ready", "delivered"];

function buildPipelineHtml(currentStatus: string): string {
  const currentIdx = PIPELINE_ORDER.indexOf(currentStatus);
  return PIPELINE_ORDER.map((stage, i) => {
    const isPast = i < currentIdx;
    const isCurrent = i === currentIdx;
    const bg = isCurrent ? "#2563eb" : isPast ? "#16a34a" : "#e2e8f0";
    const fg = isCurrent || isPast ? "#fff" : "#94a3b8";
    const border = isCurrent ? "3px solid #2563eb" : isPast ? "2px solid #16a34a" : "2px solid #e2e8f0";
    return `<div style="display:flex;align-items:center;gap:6px;flex:1;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
        <div style="width:28px;height:28px;border-radius:50%;background:${bg};border:${border};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${fg};">${i + 1}</div>
        <span style="font-size:9px;font-weight:600;color:${isCurrent ? '#2563eb' : isPast ? '#16a34a' : '#94a3b8'};text-align:center;line-height:1.2;">${PIPELINE_LABELS[stage]}</span>
      </div>
      ${i < PIPELINE_ORDER.length - 1 ? `<div style="height:2px;flex:1;min-width:12px;background:${isPast ? '#16a34a' : '#e2e8f0'};"></div>` : ''}
    </div>`;
  }).join("");
}

export function generateDepositReceipt(order: any, symbol: string) {
  const customer = order.customer || {};
  const items = order.items || [];
  const garments = order.garmentItems || [];
  const entryDate = order.entryDate ? format(new Date(order.entryDate), "MMM dd, yyyy") : format(new Date(), "MMM dd, yyyy");
  const pickupDate = order.pickupDate ? format(new Date(order.pickupDate), "MMM dd, yyyy") : "N/A";
  const discount = Number(order.discount || 0);
  const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.priceAtOrder) * item.quantity), 0);

  const statusLabel = order.paymentStatus === "paid" ? "PAID" : order.paymentStatus === "partial" ? "PARTIAL" : "UNPAID";
  const statusColor = order.paymentStatus === "paid" ? "#16a34a" : order.paymentStatus === "partial" ? "#d97706" : "#dc2626";
  const statusBg = order.paymentStatus === "paid" ? "#dcfce7" : order.paymentStatus === "partial" ? "#fef3c7" : "#fee2e2";

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

  const pipelineHtml = buildPipelineHtml(order.status || "received");

  const paymentsHtml = (order.payments || []).map((p: any) => {
    const ref = p.reference ? ` (Ref: ${p.reference})` : '';
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
      <span>${p.method}${ref}</span>
      <span style="color:#16a34a;font-weight:600;">${symbol}${Number(p.amount).toFixed(2)}</span>
    </div>`;
  }).join("") || '<div style="font-size:12px;color:#94a3b8;font-style:italic;">No payments recorded</div>';

  const totalPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(order.totalAmount) - totalPaid);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deposit Receipt - Order #${order.id}</title>
  <style>
    @media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; padding: 24px; color: #1e293b; }
    .receipt { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .print-btn { display: block; margin: 16px auto; padding: 10px 32px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .print-btn:hover { background: #1d4ed8; }
    .header { background: #1e3a5f; color: #fff; padding: 28px 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand h1 { font-size: 24px; font-weight: 700; }
    .brand p { font-size: 12px; opacity: 0.8; margin-top: 4px; line-height: 1.5; }
    .order-id-box { text-align: right; }
    .order-id-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .order-id-box .id { font-size: 28px; font-weight: 800; margin-top: 2px; }
    .deposit-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px; }
    .meta-item .value { font-size: 14px; font-weight: 600; color: #1e293b; }
    .pipeline-section { padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    .items-section { padding: 24px 32px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .items-table thead th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .items-table thead th:nth-child(2) { text-align: center; }
    .items-table thead th:last-child { text-align: right; }
    .checklist-section { padding: 0 32px 24px; }
    .checklist-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .summary { padding: 0 32px 24px; }
    .summary-box { background: #f8fafc; border-radius: 6px; padding: 16px 20px; margin-top: 8px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .summary-row.total { border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 700; color: #1e293b; }
    .summary-row .discount { color: #dc2626; }
    .payment-section { padding: 0 32px 24px; }
    .payment-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px 20px; }
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
          <div class="deposit-badge">Deposit Receipt</div>
        </div>
        <div class="order-id-box">
          <div class="label">Order No.</div>
          <div class="id">#${order.id}</div>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-item"><div class="label">Customer</div><div class="value">${customer.name || 'N/A'}</div></div>
      <div class="meta-item"><div class="label">Order Date</div><div class="value">${entryDate}</div></div>
      <div class="meta-item"><div class="label">Phone</div><div class="value">${customer.phone || 'N/A'}</div></div>
      <div class="meta-item"><div class="label">Expected Pickup</div><div class="value">${pickupDate}</div></div>
    </div>

    <div class="pipeline-section">
      <div class="section-title">Order Pipeline Tracker</div>
      <div style="display:flex;align-items:center;gap:0;padding:8px 0;">${pipelineHtml}</div>
    </div>

    <div class="items-section">
      <div class="section-title">Service Summary</div>
      <table class="items-table">
        <thead><tr><th>Service Name</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>${itemsHtml || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;">No services recorded</td></tr>`}</tbody>
      </table>
    </div>

    <div class="checklist-section">
      <div class="section-title">Garment Checklist</div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">For inventory verification only.</p>
      <table class="checklist-table"><tbody>${garmentHtml}</tbody></table>
    </div>

    <div class="summary">
      <div class="section-title">Totals</div>
      <div class="summary-box">
        <div class="summary-row"><span>Subtotal</span><span>${symbol}${subtotal.toFixed(2)}</span></div>
        ${discount > 0 ? `<div class="summary-row"><span>Discount</span><span class="discount">-${symbol}${discount.toFixed(2)}</span></div>` : ""}
        <div class="summary-row total"><span>Total Amount</span><span>${symbol}${Number(order.totalAmount).toFixed(2)}</span></div>
        <div class="summary-row"><span>Total Paid</span><span style="color:#16a34a;font-weight:600;">${symbol}${totalPaid.toFixed(2)}</span></div>
        ${balance > 0 ? `<div class="summary-row"><span>Balance Due</span><span style="color:#dc2626;font-weight:600;">${symbol}${balance.toFixed(2)}</span></div>` : ''}
      </div>
    </div>

    <div class="payment-section">
      <div class="section-title">Payment Records</div>
      <div class="payment-box">
        ${paymentsHtml}
        <div style="margin-top:12px;display:flex;justify-content:flex-end;">
          <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;background:${statusBg};color:${statusColor};">${statusLabel}</span>
        </div>
      </div>
    </div>

    <div class="terms">
      <h3>Laundry Terms & Conditions</h3>
      <ol>
        <li><strong>Liability Limit:</strong> Our liability for any lost or damaged garment shall not exceed 3x the cleaning cost of that item.</li>
        <li><strong>Pocket Policy:</strong> Customers are responsible for emptying all pockets. We are not liable for items left in pockets.</li>
        <li><strong>Unclaimed Items:</strong> Items not collected within 30 days may incur storage fees. Items left 90+ days will be donated.</li>
        <li><strong>Pre-existing Damage:</strong> We reserve the right to refuse service for items with significant pre-existing wear.</li>
        <li><strong>Stains:</strong> We cannot guarantee 100% stain removal. Some stains are permanent.</li>
        <li><strong>Claims:</strong> Any claims must be made within 24 hours of pickup with the original receipt.</li>
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
  a.download = `deposit-receipt-order-${order.id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
