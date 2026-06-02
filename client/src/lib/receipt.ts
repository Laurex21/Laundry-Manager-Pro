import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import { type ReceiptSettings, DEFAULT_SETTINGS, label, getDefaultTerms } from "./receipt-settings";

const PIPELINE_LABELS: Record<string, { en: string; fr: string }> = {
  received: { en: "Received", fr: "Reçu" },
  washing: { en: "Washing", fr: "Lavage" },
  stain_treatment: { en: "Stain Treatment", fr: "Traitement des taches" },
  drying: { en: "Drying", fr: "Séchage" },
  ironing: { en: "Ironing", fr: "Repassage" },
  ready: { en: "Ready for Pickup", fr: "Prêt à récupérer" },
  delivered: { en: "Delivered", fr: "Livré" },
};

const PIPELINE_ORDER = ["received", "washing", "stain_treatment", "drying", "ironing", "ready", "delivered"];

function dateLocaleFor(lang: string) {
  if (lang.startsWith("fr") || lang === "both" || lang === "all") return fr;
  if (lang.startsWith("pt")) return pt;
  return enUS;
}

function formatReceiptDate(date: Date | string | null | undefined, pattern: string, lang: string): string {
  if (!date) return label("N/A", "N/D", lang);
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return label("N/A", "N/D", lang);
  return format(value, pattern, { locale: dateLocaleFor(lang) });
}

function paymentReference(reference: string | null | undefined, lang: string): string {
  return reference ? ` (${label("Ref:", "Réf :", lang)} ${reference})` : "";
}

function buildPipelineHtml(currentStatus: string, lang: string): string {
  const currentIdx = PIPELINE_ORDER.indexOf(currentStatus);
  return PIPELINE_ORDER.map((stage, i) => {
    const isPast = i < currentIdx;
    const isCurrent = i === currentIdx;
    const bg = isCurrent ? "#2563eb" : isPast ? "#16a34a" : "#e2e8f0";
    const fg = isCurrent || isPast ? "#fff" : "#94a3b8";
    const border = isCurrent ? "3px solid #2563eb" : isPast ? "2px solid #16a34a" : "2px solid #e2e8f0";
    const stageLabel = PIPELINE_LABELS[stage] || { en: stage, fr: stage };
    return `<div style="display:flex;align-items:center;gap:6px;flex:1;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
        <div style="width:28px;height:28px;border-radius:50%;background:${bg};border:${border};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${fg};">${i + 1}</div>
        <span style="font-size:9px;font-weight:600;color:${isCurrent ? '#2563eb' : isPast ? '#16a34a' : '#94a3b8'};text-align:center;line-height:1.2;">${label(stageLabel.en, stageLabel.fr, lang)}</span>
      </div>
      ${i < PIPELINE_ORDER.length - 1 ? `<div style="height:2px;flex:1;min-width:12px;background:${isPast ? '#16a34a' : '#e2e8f0'};"></div>` : ''}
    </div>`;
  }).join("");
}

function buildHeader(businessName: string, subtitle: string, contactLines: string[], headerColor: string, logoBase64: string | null | undefined, showLogo: boolean): string {
  const logoHtml = showLogo && logoBase64
    ? `<img src="${logoBase64}" style="height:50px;margin-bottom:8px;display:block;border-radius:4px;" />`
    : "";
  return `
    ${logoHtml}
    <h1 style="font-size:24px;font-weight:700;">${businessName}</h1>
    ${subtitle ? `<p style="font-size:12px;opacity:0.8;margin-top:4px;">${subtitle}</p>` : ""}
    ${contactLines.length > 0 ? `<p style="font-size:11px;opacity:0.75;margin-top:6px;line-height:1.6;">${contactLines.join(" &bull; ")}</p>` : ""}
  `;
}

function buildTermsHtml(settings: ReceiptSettings, lang: string): string {
  const rawTerms = settings.termsOfService || getDefaultTerms(lang);
  const lines = rawTerms.split("\n").filter(l => l.trim());
  return `<ol style="padding-left:18px;margin:0;">${lines.map(line => `<li style="font-size:10.5px;color:#64748b;line-height:1.6;margin-bottom:8px;">${line.trim()}</li>`).join("")}</ol>`;
}

function getContactLines(settings: ReceiptSettings): string[] {
  const addressPart = [settings.address, settings.city].filter(Boolean).join(", ");
  return [addressPart, settings.country, settings.phone, settings.phone2, settings.email, settings.website].filter(Boolean) as string[];
}

function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateDepositReceipt(order: any, symbol: string, settings: ReceiptSettings = DEFAULT_SETTINGS) {
  const lang = settings.receiptLanguage || "en";
  const customer = order.customer || {};
  const items = order.items || [];
  const garments = order.garmentItems || [];
  const entryDate = formatReceiptDate(order.entryDate || new Date(), "MMM dd, yyyy", lang);
  const pickupDate = formatReceiptDate(order.pickupDate, "MMM dd, yyyy", lang);
  const discount = Number(order.discount || 0);
  const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.priceAtOrder) * item.quantity), 0);

  const statusLabel = order.paymentStatus === "paid" ? label("PAID", "PAYÉ", lang) : order.paymentStatus === "partial" ? label("PARTIAL", "PARTIEL", lang) : label("UNPAID", "IMPAYÉ", lang);
  const statusColor = order.paymentStatus === "paid" ? "#16a34a" : order.paymentStatus === "partial" ? "#d97706" : "#dc2626";
  const statusBg = order.paymentStatus === "paid" ? "#dcfce7" : order.paymentStatus === "partial" ? "#fef3c7" : "#fee2e2";

  const itemsHtml = items.map((item: any) => {
    const svc = item.service || {};
    const qty = item.quantity;
    const unit = svc.unit === "kg" ? label("Loads", "Charges", lang) : label("Pieces", "Pièces", lang);
    const price = Number(item.priceAtOrder);
    const lineTotal = qty * price;
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${svc.name || label("Service", "Service", lang)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty} ${unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${symbol}${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const garmentHtml = garments.length > 0 ? garments.map((g: any) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;">${g.quantity} x ${g.itemName}</td></tr>`
  ).join("") : `<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;">${label("No garment items recorded", "Aucun vêtement enregistré", lang)}</td></tr>`;

  const pipelineHtml = buildPipelineHtml(order.status || "received", lang);

  const paymentsHtml = (order.payments || []).map((p: any) => {
    const ref = paymentReference(p.reference, lang);
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
      <span>${p.method}${ref}</span>
      <span style="color:#16a34a;font-weight:600;">${symbol}${Number(p.amount).toFixed(2)}</span>
    </div>`;
  }).join("") || `<div style="font-size:12px;color:#94a3b8;font-style:italic;">${label("No payments recorded", "Aucun paiement enregistré", lang)}</div>`;

  const totalPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(order.totalAmount) - totalPaid);

  const contactLines = getContactLines(settings);
  const tagline = settings.tagline || label("Laundry Service", "Service de Blanchisserie", lang);
  const headerHtml = buildHeader(settings.businessName, tagline, contactLines, settings.receiptHeaderColor, settings.logoBase64, settings.showLogo);
  const termsHtml = settings.showTerms ? buildTermsHtml(settings, lang) : "";
  const footerNote = settings.receiptFooterNote || label("Thank you for your trust", "Merci de votre confiance", lang);
  const generatedLabel = label("Receipt generated on", "Reçu généré le", lang);
  const depositLabel = label("Deposit Receipt", "Reçu de Dépôt", lang);
  const orderTitle = label("Order No.", "N° Commande", lang);
  const emptyValue = label("N/A", "N/D", lang);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${depositLabel} - ${orderTitle} ${order.id}</title>
  <style>
    @media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; padding: 24px; color: #1e293b; }
    .receipt { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .print-btn { display: block; margin: 16px auto; padding: 10px 32px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .print-btn:hover { background: #1d4ed8; }
    .header { background: ${settings.receiptHeaderColor}; color: #fff; padding: 28px 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { flex: 1; }
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
    .payment-section { padding: 0 32px 24px; }
    .payment-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px 20px; }
    .terms { padding: 24px 32px; border-top: 1px solid #e2e8f0; background: #fafbfc; }
    .terms h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    .footer { text-align: center; padding: 20px 32px; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 12px; color: #94a3b8; }
    .footer .thanks { font-size: 14px; font-weight: 600; color: ${settings.receiptHeaderColor}; margin-bottom: 4px; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">${label("Print Receipt", "Imprimer le reçu", lang)}</button>
  <div class="receipt">
    <div class="header">
      <div class="header-top">
        <div class="brand">${headerHtml}<div class="deposit-badge">${depositLabel}</div></div>
        <div class="order-id-box">
          <div class="label">${label("Order No.", "N° Commande", lang)}</div>
          <div class="id">#${order.id}</div>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-item"><div class="label">${label("Customer", "Client", lang)}</div><div class="value">${customer.name || emptyValue}</div></div>
      <div class="meta-item"><div class="label">${label("Order Date", "Date de commande", lang)}</div><div class="value">${entryDate}</div></div>
      <div class="meta-item"><div class="label">${label("Phone", "Téléphone", lang)}</div><div class="value">${customer.phone || emptyValue}</div></div>
      ${settings.showPickupDate ? `<div class="meta-item"><div class="label">${label("Expected Pickup", "Retrait prévu", lang)}</div><div class="value">${pickupDate}</div></div>` : ""}
    </div>

    <div class="pipeline-section">
      <div class="section-title">${label("Order Pipeline Tracker", "Suivi du pipeline de commande", lang)}</div>
      <div style="display:flex;align-items:center;gap:0;padding:8px 0;">${pipelineHtml}</div>
    </div>

    <div class="items-section">
      <div class="section-title">${label("Service Summary", "Résumé des services", lang)}</div>
      <table class="items-table">
        <thead><tr><th>${label("Service Name", "Service", lang)}</th><th>${label("Qty", "Qté", lang)}</th><th>${label("Price", "Prix", lang)}</th></tr></thead>
        <tbody>${itemsHtml || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;">${label("No services recorded", "Aucun service enregistré", lang)}</td></tr>`}</tbody>
      </table>
    </div>

    ${settings.showGarmentList ? `
    <div class="checklist-section">
      <div class="section-title">${label("Garment Checklist", "Checklist des vêtements", lang)}</div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">${label("For inventory verification only.", "Pour vérification d'inventaire uniquement.", lang)}</p>
      <table class="checklist-table"><tbody>${garmentHtml}</tbody></table>
    </div>` : ""}

    <div class="summary">
      <div class="section-title">${label("Totals", "Totaux", lang)}</div>
      <div class="summary-box">
        <div class="summary-row"><span>${label("Subtotal", "Sous-total", lang)}</span><span>${symbol}${subtotal.toFixed(2)}</span></div>
        ${discount > 0 ? `<div class="summary-row"><span>${label("Discount", "Réduction", lang)}</span><span style="color:#dc2626;">-${symbol}${discount.toFixed(2)}</span></div>` : ""}
        <div class="summary-row total"><span>${label("Total Amount", "Montant total", lang)}</span><span>${symbol}${Number(order.totalAmount).toFixed(2)}</span></div>
        <div class="summary-row"><span>${label("Total Paid", "Total payé", lang)}</span><span style="color:#16a34a;font-weight:600;">${symbol}${totalPaid.toFixed(2)}</span></div>
        ${balance > 0 ? `<div class="summary-row"><span>${label("Balance Due", "Solde dû", lang)}</span><span style="color:#dc2626;font-weight:600;">${symbol}${balance.toFixed(2)}</span></div>` : ''}
      </div>
    </div>

    ${settings.showPaymentHistory ? `
    <div class="payment-section">
      <div class="section-title">${label("Payment Records", "Historique des paiements", lang)}</div>
      <div class="payment-box">
        ${paymentsHtml}
        <div style="margin-top:12px;display:flex;justify-content:flex-end;">
          <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;background:${statusBg};color:${statusColor};">${statusLabel}</span>
        </div>
      </div>
    </div>` : ""}

    ${settings.showTerms ? `
    <div class="terms">
      <h3>${label("Terms & Conditions", "Conditions Générales", lang)}</h3>
      ${termsHtml}
    </div>` : ""}

    <div class="footer">
      <p class="thanks">${footerNote}</p>
      <p>${settings.businessName} &bull; ${generatedLabel} ${formatReceiptDate(new Date(), "PPP", lang)}</p>
    </div>
  </div>
</body>
</html>`;

  downloadHtml(html, `deposit-receipt-order-${order.id}.html`);
}

export function generatePaymentReceipt(
  orderId: number,
  customer: any,
  items: any[],
  garments: any[],
  payment: { amount: string; method: string; date: string; newStatus: string },
  allPayments: any[],
  entryDate: string,
  pickupDate: string,
  discount: number,
  symbol: string,
  settings: ReceiptSettings = DEFAULT_SETTINGS
) {
  const lang = settings.receiptLanguage || "en";
  const displayEntryDate = formatReceiptDate(entryDate, "MMM dd, yyyy", lang);
  const displayPickupDate = formatReceiptDate(pickupDate, "MMM dd, yyyy", lang);

  const itemsHtml = items.map((item: any) => {
    const svc = item.service || {};
    const qty = item.quantity;
    const unit = svc.unit === "kg" ? label("Loads", "Charges", lang) : label("Pieces", "Pièces", lang);
    const price = Number(item.priceAtOrder);
    const lineTotal = qty * price;
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${svc.name || label("Service", "Service", lang)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty} ${unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${symbol}${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const garmentHtml = garments.length > 0 ? garments.map((g: any) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;">${g.quantity} x ${g.itemName}</td></tr>`
  ).join("") : `<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;">${label("No garment items recorded", "Aucun vêtement enregistré", lang)}</td></tr>`;

  const subtotalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.priceAtOrder) * item.quantity), 0);
  const statusLabel = payment.newStatus === "paid" ? label("PAID", "PAYÉ", lang) : payment.newStatus === "partial" ? label("PARTIAL", "PARTIEL", lang) : label("UNPAID", "IMPAYÉ", lang);
  const statusColor = payment.newStatus === "paid" ? "#16a34a" : payment.newStatus === "partial" ? "#d97706" : "#dc2626";
  const statusBg = payment.newStatus === "paid" ? "#dcfce7" : payment.newStatus === "partial" ? "#fef3c7" : "#fee2e2";

  const paymentsHistoryHtml = settings.showPaymentHistory && allPayments.length > 0
    ? allPayments.map((p: any) => {
        const ref = paymentReference(p.reference, lang);
        return `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
          <span>${formatReceiptDate(p.date || payment.date, "MMM dd", lang)} &bull; ${p.method}${ref}</span>
          <span style="color:#16a34a;font-weight:600;">${symbol}${Number(p.amount).toFixed(2)}</span>
        </div>`;
      }).join("")
    : "";

  const contactLines = getContactLines(settings);
  const tagline = settings.tagline || label("Laundry Service", "Service de Blanchisserie", lang);
  const headerHtml = buildHeader(settings.businessName, tagline, contactLines, settings.receiptHeaderColor, settings.logoBase64, settings.showLogo);
  const termsHtml = settings.showTerms ? buildTermsHtml(settings, lang) : "";
  const footerNote = settings.receiptFooterNote || label("Thank you for your trust", "Merci de votre confiance", lang);
  const receiptTitle = label("Payment Receipt", "Reçu de Paiement", lang);
  const generatedLabel = label("Receipt generated on", "Reçu généré le", lang);
  const orderTitle = label("Order No.", "N° Commande", lang);
  const emptyValue = label("N/A", "N/D", lang);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${receiptTitle} - ${orderTitle} ${orderId}</title>
  <style>
    @media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; padding: 24px; color: #1e293b; }
    .receipt { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .print-btn { display: block; margin: 16px auto; padding: 10px 32px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .header { background: ${settings.receiptHeaderColor}; color: #fff; padding: 28px 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { flex: 1; }
    .order-id-box { text-align: right; }
    .order-id-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .order-id-box .id { font-size: 28px; font-weight: 800; margin-top: 2px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px; }
    .meta-item .value { font-size: 14px; font-weight: 600; color: #1e293b; }
    .section { padding: 24px 32px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .items-table thead th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .items-table thead th:nth-child(2) { text-align: center; }
    .items-table thead th:last-child { text-align: right; }
    .summary-box { background: #f8fafc; border-radius: 6px; padding: 16px 20px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .summary-row.total { border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 700; color: #1e293b; }
    .payment-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px 20px; }
    .payment-amount { font-size: 24px; font-weight: 800; color: #16a34a; }
    .terms { padding: 24px 32px; border-top: 1px solid #e2e8f0; background: #fafbfc; }
    .terms h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    .footer { text-align: center; padding: 20px 32px; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 12px; color: #94a3b8; }
    .footer .thanks { font-size: 14px; font-weight: 600; color: ${settings.receiptHeaderColor}; margin-bottom: 4px; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">${label("Print Receipt", "Imprimer le reçu", lang)}</button>
  <div class="receipt">
    <div class="header">
      <div class="header-top">
        <div class="brand">${headerHtml}</div>
        <div class="order-id-box">
          <div class="label">${label("Order No.", "N° Commande", lang)}</div>
          <div class="id">#${orderId}</div>
        </div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-item"><div class="label">${label("Customer", "Client", lang)}</div><div class="value">${customer.name || emptyValue}</div></div>
      <div class="meta-item"><div class="label">${label("Order Date", "Date de commande", lang)}</div><div class="value">${displayEntryDate}</div></div>
      <div class="meta-item"><div class="label">${label("Receipt Date", "Date du reçu", lang)}</div><div class="value">${formatReceiptDate(payment.date, "MMM dd, yyyy", lang)}</div></div>
      ${settings.showPickupDate ? `<div class="meta-item"><div class="label">${label("Expected Pickup", "Retrait prévu", lang)}</div><div class="value">${displayPickupDate}</div></div>` : ""}
    </div>

    <div class="section">
      <div class="section-title">${label("This Payment", "Ce paiement", lang)}</div>
      <div class="payment-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${label("Method", "Méthode", lang)}: ${payment.method}</div>
            <div class="payment-amount">${symbol}${Number(payment.amount).toFixed(2)}</div>
          </div>
          <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;background:${statusBg};color:${statusColor};">${statusLabel}</span>
        </div>
      </div>
    </div>

    <div class="section" style="padding-top:0;">
      <div class="section-title">${label("Service Summary", "Résumé des services", lang)}</div>
      <table class="items-table">
        <thead><tr><th>${label("Service", "Service", lang)}</th><th>${label("Qty", "Qté", lang)}</th><th>${label("Price", "Prix", lang)}</th></tr></thead>
        <tbody>${itemsHtml || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;">${label("No services recorded", "Aucun service enregistré", lang)}</td></tr>`}</tbody>
      </table>
      <div class="summary-box" style="margin-top:12px;">
        <div class="summary-row"><span>${label("Subtotal", "Sous-total", lang)}</span><span>${symbol}${subtotalAmount.toFixed(2)}</span></div>
        ${discount > 0 ? `<div class="summary-row"><span>${label("Discount", "Réduction", lang)}</span><span style="color:#dc2626;">-${symbol}${discount.toFixed(2)}</span></div>` : ""}
        <div class="summary-row total"><span>${label("Order Total", "Total commande", lang)}</span><span>${symbol}${(subtotalAmount - discount).toFixed(2)}</span></div>
      </div>
    </div>

    ${settings.showGarmentList ? `
    <div class="section" style="padding-top:0;">
      <div class="section-title">${label("Garment Checklist", "Checklist des vêtements", lang)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${garmentHtml}</tbody></table>
    </div>` : ""}

    ${paymentsHistoryHtml ? `
    <div class="section" style="padding-top:0;">
      <div class="section-title">${label("Payment History", "Historique des paiements", lang)}</div>
      <div class="payment-box">${paymentsHistoryHtml}</div>
    </div>` : ""}

    ${settings.showTerms ? `
    <div class="terms">
      <h3>${label("Terms & Conditions", "Conditions Générales", lang)}</h3>
      ${termsHtml}
    </div>` : ""}

    <div class="footer">
      <p class="thanks">${footerNote}</p>
      <p>${settings.businessName} &bull; ${generatedLabel} ${formatReceiptDate(new Date(), "PPP", lang)}</p>
    </div>
  </div>
</body>
</html>`;

  downloadHtml(html, `payment-receipt-order-${orderId}.html`);
}
