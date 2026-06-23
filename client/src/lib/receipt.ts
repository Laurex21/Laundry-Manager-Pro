import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import { type ReceiptSettings, DEFAULT_SETTINGS, label, getDefaultTerms } from "./receipt-settings";

const PIPELINE_LABELS: Record<string, { en: string; fr: string }> = {
  received: { en: "Received", fr: "Reçu" },
  sorting: { en: "Sorting", fr: "Tri" },
  washing: { en: "Washing", fr: "Lavage" },
  stain_treatment: { en: "Stain Treatment", fr: "Traitement des taches" },
  drying: { en: "Drying", fr: "Séchage" },
  ironing: { en: "Ironing", fr: "Repassage" },
  packaging: { en: "Packaging", fr: "Emballage" },
  ready: { en: "Ready for Pickup", fr: "Prêt à récupérer" },
  delivered: { en: "Delivered", fr: "Livré" },
};

const PIPELINE_ORDER = ["received", "sorting", "washing", "drying", "ironing", "packaging", "ready", "delivered"];

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

function serviceUnitLabel(unit: string | null | undefined, lang: string): string {
  return unit === "kg" ? "kg" : label("Pieces", "Pièces", lang);
}

function orderSubtotal(items: any[]): number {
  return items.reduce((sum: number, item: any) => sum + (Number(item.priceAtOrder) * Number(item.quantity || 0)), 0);
}

function orderTotalFromParts(subtotal: number, discount: number, pickupCost: number): number {
  return Math.max(0, subtotal - discount + pickupCost);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function orderDisplayId(order: any): number | string {
  return order?.orderNumber ?? order?.id ?? "";
}

function buildPipelineHtml(currentStatus: string, lang: string): string {
  const normalizedStatus = currentStatus === "stain_treatment" ? "sorting" : currentStatus;
  const currentIdx = PIPELINE_ORDER.indexOf(normalizedStatus);
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
        <span style="font-size:9px;font-weight:600;color:${isCurrent ? '#2563eb' : isPast ? '#16a34a' : '#94a3b8'};text-align:center;line-height:1.2;">${escapeHtml(label(stageLabel.en, stageLabel.fr, lang))}</span>
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
    <h1 style="font-size:24px;font-weight:700;">${escapeHtml(businessName)}</h1>
    ${subtitle ? `<p style="font-size:12px;opacity:0.8;margin-top:4px;">${escapeHtml(subtitle)}</p>` : ""}
    ${contactLines.length > 0 ? `<p style="font-size:11px;opacity:0.75;margin-top:6px;line-height:1.6;">${contactLines.map(escapeHtml).join(" &bull; ")}</p>` : ""}
  `;
}

function buildTermsHtml(settings: ReceiptSettings, lang: string): string {
  const rawTerms = settings.termsOfService || getDefaultTerms(lang);
  const lines = rawTerms.split("\n").filter(l => l.trim());
  return `<ol style="padding-left:18px;margin:0;">${lines.map(line => `<li style="font-size:10.5px;color:#64748b;line-height:1.6;margin-bottom:8px;">${escapeHtml(line.trim())}</li>`).join("")}</ol>`;
}

function getContactLines(settings: ReceiptSettings): string[] {
  const addressPart = [settings.address, settings.city].filter(Boolean).join(", ");
  return [addressPart, settings.country, settings.phone, settings.phone2, settings.email, settings.website].filter(Boolean) as string[];
}

function getReceiptContactLines(settings: ReceiptSettings, receiptNumber: number | string, lang: string): string[] {
  const receiptLine = `${label("Receipt No.", "N° Reçu", lang)} #${receiptNumber}`;
  const lines = getContactLines(settings);
  const phoneIndex = lines.findIndex((line) => line === settings.phone);
  if (phoneIndex >= 0) {
    return [...lines.slice(0, phoneIndex + 1), receiptLine, ...lines.slice(phoneIndex + 1)];
  }
  return [...lines, receiptLine];
}

function chronologicalPayments(payments: any[]): any[] {
  return [...payments].sort((a: any, b: any) => {
    const aTime = new Date(a.date || a.createdAt || 0).getTime();
    const bTime = new Date(b.date || b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function buildPaymentHistoryLines(payments: any[], orderTotal: number, symbol: string, lang: string, fallbackDate?: string): string[] {
  let paidSoFar = 0;
  return chronologicalPayments(payments).map((payment: any) => {
    const amount = Number(payment.amount || 0);
    paidSoFar += amount;
    const remaining = Math.max(0, orderTotal - paidSoFar);
    const ref = paymentReference(payment.reference, lang);
    const paidLabel = label("Paid", "Payé", lang);
    const remainingLabel = label("Remaining balance", "Solde restant", lang);
    return `${formatReceiptDate(payment.date || fallbackDate, "MMM dd", lang)} - ${payment.method}${ref} - ${paidLabel}: ${symbol}${amount.toFixed(2)} - ${remainingLabel}: ${remaining > 0 ? `${symbol}${remaining.toFixed(2)}` : label("FULLY PAID", "ENTIÈREMENT PAYÉ", lang)}`;
  });
}

function buildPaymentHistoryHtml(payments: any[], orderTotal: number, symbol: string, lang: string, fallbackDate?: string): string {
  let paidSoFar = 0;
  return chronologicalPayments(payments).map((payment: any) => {
    const amount = Number(payment.amount || 0);
    paidSoFar += amount;
    const remaining = Math.max(0, orderTotal - paidSoFar);
    const ref = paymentReference(payment.reference, lang);
    return `<div style="padding:8px 0;border-bottom:1px solid rgba(14,165,233,0.18);font-size:12px;color:#475569;">
      <div style="display:flex;justify-content:space-between;gap:12px;">
        <span>${formatReceiptDate(payment.date || fallbackDate, "MMM dd", lang)} &bull; ${escapeHtml(payment.method)}${escapeHtml(ref)}</span>
        <span style="color:#16a34a;font-weight:600;white-space:nowrap;">${symbol}${amount.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px;font-size:11px;font-weight:700;color:${remaining > 0 ? "#dc2626" : "#16a34a"};">
        <span>${label("Remaining balance", "Solde restant", lang)}</span>
        <span>${remaining > 0 ? `${symbol}${remaining.toFixed(2)}` : label("FULLY PAID", "ENTIÈREMENT PAYÉ", lang)}</span>
      </div>
    </div>`;
  }).join("");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function thermalMoney(amount: number, symbol: string): string {
  const currency = symbol.trim();
  const rounded = Math.round(amount).toLocaleString("fr-FR");
  return /^[A-Z]{2,5}$/.test(currency) || currency === "UM"
    ? `${rounded} ${currency}`
    : `${currency}${amount.toFixed(2)}`;
}

function thermalLine(labelText: string, value: string, strong = false): string {
  return `<div class="line${strong ? " strong" : ""}"><span>${escapeHtml(labelText)}</span><span>${escapeHtml(value)}</span></div>`;
}

function thermalDivider(): string {
  return `<div class="divider"></div>`;
}

function buildThermalReceiptHtml(args: {
  title: string;
  orderId: number | string;
  businessName: string;
  contactLines: string[];
  customerName: string;
  customerPhone?: string;
  orderDate: string;
  receiptDate: string;
  items: any[];
  garments: any[];
  subtotal: number;
  discount: number;
  pickupCost: number;
  orderTotal: number;
  totalPaid: number;
  balance: number;
  symbol: string;
  footerNote: string;
  lang: string;
  logoBase64?: string | null;
  showLogo?: boolean;
  paymentLine?: string;
  methodLine?: string;
}): string {
  const itemRows = args.items.map((item: any) => {
    const service = item.service || {};
    const quantity = Number(item.quantity || 0);
    const unit = serviceUnitLabel(service.unit, args.lang);
    const price = Number(item.priceAtOrder || 0);
    const total = quantity * price;
    return `<div class="item">
      <div class="item-name">${escapeHtml(service.name || label("Service", "Service", args.lang))}</div>
      <div class="item-meta">${escapeHtml(`${quantity} ${unit} x ${thermalMoney(price, args.symbol)}`)}<span>${escapeHtml(thermalMoney(total, args.symbol))}</span></div>
    </div>`;
  }).join("");

  const garmentRows = args.garments.length > 0
    ? args.garments.map((garment: any) => {
        const name = garment.itemName || garment.name || label("Item", "Article", args.lang);
        return `<div class="compact-row">${escapeHtml(`${garment.quantity || 1} x ${name}`)}</div>`;
      }).join("")
    : "";

  const paidInFull = args.balance <= 0 && args.totalPaid > 0;
  const logoHtml = args.showLogo && args.logoBase64
    ? `<img class="logo" src="${escapeHtml(args.logoBase64)}" alt="${escapeHtml(args.businessName)} logo" />`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(args.title)} #${args.orderId}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: "Courier New", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.25; font-weight: 700; }
    body * { font-weight: 700 !important; }
    .toolbar { padding: 10px; text-align: center; background: #f3f4f6; }
    .toolbar button { border: 1px solid #111; background: #fff; color: #111; padding: 8px 14px; font: 600 13px Arial, sans-serif; cursor: pointer; }
    .ticket { width: 80mm; max-width: 80mm; padding: 4mm 3mm 5mm; margin: 0 auto; }
    .center { text-align: center; }
    .logo { display: block; max-width: 38mm; max-height: 18mm; object-fit: contain; margin: 0 auto 3mm; }
    .business { font-size: 15px; font-weight: 800; line-height: 1.1; text-transform: uppercase; overflow-wrap: anywhere; }
    .muted { font-size: 10px; }
    .title { font-size: 12px; font-weight: 800; margin-top: 4px; text-transform: uppercase; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; height: 0; }
    .line { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
    .line span:first-child { max-width: 44mm; }
    .line span:last-child { text-align: right; font-weight: 600; }
    .line.strong { font-weight: 800; font-size: 12px; }
    .item { margin: 4px 0; }
    .item-name { font-weight: 700; overflow-wrap: anywhere; }
    .item-meta { display: flex; justify-content: space-between; gap: 6px; font-size: 10px; }
    .compact-row { font-size: 10px; margin: 1px 0; overflow-wrap: anywhere; }
    .paid { text-align: center; font-weight: 900; font-size: 13px; margin: 5px 0 1px; }
    .footer { text-align: center; font-size: 10px; margin-top: 6px; overflow-wrap: anywhere; }
    @media print {
      .toolbar { display: none; }
      .ticket { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">${escapeHtml(label("Print", "Imprimer", args.lang))}</button></div>
  <main class="ticket">
    <section class="center">
      ${logoHtml}
      <div class="business">${escapeHtml(args.businessName)}</div>
      ${args.contactLines.slice(0, 4).map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join("")}
      <div class="title">${escapeHtml(args.title)}</div>
    </section>
    ${thermalDivider()}
    ${thermalLine(label("Order No.", "N° Commande", args.lang), `#${args.orderId}`)}
    ${thermalLine(label("Customer", "Client", args.lang), args.customerName || label("N/A", "N/D", args.lang))}
    ${args.customerPhone ? thermalLine(label("Phone", "Téléphone", args.lang), args.customerPhone) : ""}
    ${thermalLine(label("Order Date", "Date de commande", args.lang), args.orderDate)}
    ${thermalLine(label("Receipt Date", "Date du reçu", args.lang), args.receiptDate)}
    ${args.methodLine ? thermalLine(label("Method", "Méthode", args.lang), args.methodLine) : ""}
    ${args.paymentLine ? thermalLine(label("This Payment", "Ce paiement", args.lang), args.paymentLine, true) : ""}
    ${thermalDivider()}
    <div class="center strong">${escapeHtml(label("Services", "Services", args.lang).toUpperCase())}</div>
    ${itemRows || `<div class="compact-row center">${escapeHtml(label("No services recorded", "Aucun service enregistré", args.lang))}</div>`}
    ${garmentRows ? `${thermalDivider()}<div class="center strong">${escapeHtml(label("Garments", "Vêtements", args.lang).toUpperCase())}</div>${garmentRows}` : ""}
    ${thermalDivider()}
    ${thermalLine(label("Subtotal", "Sous-total", args.lang).toUpperCase(), thermalMoney(args.subtotal, args.symbol))}
    ${args.discount > 0 ? thermalLine(label("Discount", "Réduction", args.lang).toUpperCase(), `-${thermalMoney(args.discount, args.symbol)}`) : ""}
    ${args.pickupCost > 0 ? thermalLine(label("Transport / Delivery", "Transport / Livraison", args.lang).toUpperCase(), thermalMoney(args.pickupCost, args.symbol)) : ""}
    ${thermalLine("TOTAL", thermalMoney(args.orderTotal, args.symbol), true)}
    ${thermalLine("ADVANCE PAID", thermalMoney(args.totalPaid, args.symbol), true)}
    ${thermalLine("BALANCE DUE", thermalMoney(args.balance, args.symbol), true)}
    ${paidInFull ? `<div class="paid">PAID IN FULL</div>` : ""}
    ${thermalDivider()}
    <div class="footer">${escapeHtml(args.footerNote)}</div>
  </main>
  <script>
    window.addEventListener("load", function () {
      var images = Array.prototype.slice.call(document.images || []);
      var waitForImages = images.map(function (img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      });
      Promise.all(waitForImages).then(function () {
        window.setTimeout(function () { window.print(); }, 250);
      });
    });
  </script>
</body>
</html>`;
}

function openThermalReceiptPrintWindow(html: string): void {
  const win = window.open("", "_blank", "width=420,height=760");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

type PdfLine = { label?: string; value: string; strong?: boolean };
type PdfSection = { title: string; lines: PdfLine[] };

function wrapPdfText(text: string, maxChars = 78): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function downloadReceiptPdf(args: {
  filename: string;
  title: string;
  businessName: string;
  subtitle?: string;
  contactLines?: string[];
  logoBase64?: string | null;
  sections: PdfSection[];
  footer: string;
}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 44;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (space: number) => {
    if (y - space < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };
  const draw = (text: string, x: number, size = 10, font = regular, color = rgb(0.12, 0.16, 0.22)) => {
    page.drawText(text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, ""), { x, y, size, font, color });
  };

  page.drawRectangle({ x: 0, y: pageHeight - 118, width: pageWidth, height: 118, color: rgb(0.08, 0.22, 0.45) });
  let brandX = margin;
  if (args.logoBase64) {
    try {
      const [meta, data] = args.logoBase64.split(",");
      const bytes = Uint8Array.from(atob(data || meta), c => c.charCodeAt(0));
      const image = meta?.includes("image/jpeg") || meta?.includes("image/jpg")
        ? await pdf.embedJpg(bytes)
        : await pdf.embedPng(bytes);
      const scale = Math.min(56 / image.width, 42 / image.height);
      page.drawImage(image, { x: margin, y: pageHeight - 86, width: image.width * scale, height: image.height * scale });
      brandX = margin + image.width * scale + 14;
    } catch {
      brandX = margin;
    }
  }
  page.drawText(args.businessName.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, ""), { x: brandX, y, size: 22, font: bold, color: rgb(1, 1, 1) });
  y -= 26;
  if (args.subtitle) {
    page.drawText(args.subtitle.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, ""), { x: brandX, y, size: 10, font: regular, color: rgb(0.86, 0.91, 0.98) });
    y -= 15;
  }
  (args.contactLines || []).slice(0, 3).forEach((line) => {
    page.drawText(line.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, ""), { x: brandX, y, size: 8, font: regular, color: rgb(0.86, 0.91, 0.98) });
    y -= 12;
  });
  y = pageHeight - 52;
  draw(args.title, pageWidth - 230, 16, bold, rgb(1, 1, 1));
  y = pageHeight - 150;

  args.sections.forEach((section) => {
    ensureSpace(48);
    draw(section.title.toUpperCase(), margin, 10, bold, rgb(0.37, 0.45, 0.56));
    y -= 16;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.82, 0.86, 0.91) });
    y -= 14;

    section.lines.forEach((line) => {
      const prefix = line.label ? `${line.label}: ` : "";
      const wrapped = wrapPdfText(`${prefix}${line.value}`);
      wrapped.forEach((wrappedLine, idx) => {
        ensureSpace(18);
        draw(wrappedLine, margin + (idx > 0 ? 14 : 0), line.strong ? 11 : 10, line.strong ? bold : regular);
        y -= 15;
      });
    });
    y -= 8;
  });

  ensureSpace(28);
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.82, 0.86, 0.91) });
  y -= 18;
  draw(args.footer, margin, 9, regular, rgb(0.37, 0.45, 0.56));

  const bytes = await pdf.save();
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), args.filename);
}

function openReceiptPrintWindow(html: string): void {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
}

type ReceiptAction = "download" | "print";

export function generateDepositReceipt(order: any, symbol: string, settings: ReceiptSettings = DEFAULT_SETTINGS, action: ReceiptAction = "download") {
  const lang = settings.receiptLanguage || "en";
  const displayOrderId = orderDisplayId(order);
  const customer = order.customer || {};
  const items = order.items || [];
  const garments = order.garmentItems || [];
  const entryDate = formatReceiptDate(order.entryDate || new Date(), "MMM dd, yyyy", lang);
  const pickupDate = formatReceiptDate(order.pickupDate, "MMM dd, yyyy", lang);
  const discount = Number(order.discount || 0);
  const subtotal = orderSubtotal(items);
  const pickupCost = Number(order.pickupCost || 0);
  const orderTotal = orderTotalFromParts(subtotal, discount, pickupCost);

  const statusLabel = order.paymentStatus === "paid" ? label("PAID", "PAYÉ", lang) : order.paymentStatus === "partial" ? label("PARTIAL", "PARTIEL", lang) : label("UNPAID", "IMPAYÉ", lang);
  const statusColor = order.paymentStatus === "paid" ? "#16a34a" : order.paymentStatus === "partial" ? "#d97706" : "#dc2626";
  const statusBg = order.paymentStatus === "paid" ? "#dcfce7" : order.paymentStatus === "partial" ? "#fef3c7" : "#fee2e2";

  const itemsHtml = items.map((item: any) => {
    const svc = item.service || {};
    const qty = item.quantity;
    const unit = serviceUnitLabel(svc.unit, lang);
    const price = Number(item.priceAtOrder);
    const lineTotal = qty * price;
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(svc.name || label("Service", "Service", lang))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty} ${unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${symbol}${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const garmentHtml = garments.length > 0 ? garments.map((g: any) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;">${g.quantity} x ${escapeHtml(g.itemName)}${g.details ? `<br><span style="font-size:10px;color:#64748b;">${escapeHtml(g.details)}</span>` : ""}</td></tr>`
  ).join("") : `<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;">${label("No garment items recorded", "Aucun vêtement enregistré", lang)}</td></tr>`;

  const pipelineHtml = buildPipelineHtml(order.status || "received", lang);

  const totalPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const balance = Math.max(0, orderTotal - totalPaid);
  const paymentsHtml = (order.payments || []).length
    ? buildPaymentHistoryHtml(order.payments || [], orderTotal, symbol, lang, order.entryDate)
    : `<div style="font-size:12px;color:#94a3b8;font-style:italic;">${label("No payments recorded", "Aucun paiement enregistré", lang)}</div>`;

  const contactLines = getReceiptContactLines(settings, displayOrderId, lang);
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
  <title>${depositLabel} - ${orderTitle} ${orderDisplayId(order)}</title>
  <style>
    @media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; padding: 24px; color: #1e293b; }
    .receipt { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .print-btn { display: block; margin: 16px auto; padding: 10px 32px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .print-btn:hover { background: #1d4ed8; }
    .header { background: ${settings.receiptHeaderColor}; color: #fff; padding: 28px 32px; }
    .brand { max-width: 100%; }
    .order-id-inline { margin-top: 12px; }
    .order-id-inline .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .order-id-inline .id { font-size: 28px; font-weight: 800; margin-top: 2px; }
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
      <div class="brand">
        ${headerHtml}
        <div class="order-id-inline">
          <div class="label">${label("Order No.", "N° Commande", lang)}</div>
          <div class="id">#${orderDisplayId(order)}</div>
        </div>
        <div class="deposit-badge">${depositLabel}</div>
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
        ${pickupCost > 0 ? `<div class="summary-row"><span>${label("Transport / Delivery", "Transport / Livraison", lang)}</span><span style="color:#2563eb;">+${symbol}${pickupCost.toFixed(2)}</span></div>` : ""}
        <div class="summary-row total"><span>${label("Total Amount", "Montant total", lang)}</span><span>${symbol}${orderTotal.toFixed(2)}</span></div>
        ${totalPaid > 0 ? `<div class="summary-row" style="margin-top:6px;"><span>${label("Advance Payment", "Acompte versé", lang)} <span style="font-size:10px;background:#dcfce7;color:#16a34a;padding:2px 7px;border-radius:20px;font-weight:700;margin-left:4px;">${label("PAID", "PAYÉ", lang)}</span></span><span style="color:#16a34a;font-weight:600;">-${symbol}${totalPaid.toFixed(2)}</span></div>` : ""}
        ${balance > 0
          ? `<div class="summary-row" style="border-top:2px solid #fca5a5;margin-top:8px;padding-top:10px;"><span style="font-weight:700;color:#dc2626;">${label("Balance Due", "Solde dû", lang)}</span><span style="color:#dc2626;font-weight:700;font-size:15px;">${symbol}${balance.toFixed(2)}</span></div>`
          : totalPaid > 0 ? `<div class="summary-row" style="border-top:2px solid #86efac;margin-top:8px;padding-top:10px;"><span style="font-weight:700;color:#16a34a;">${label("Balance Due", "Solde dû", lang)}</span><span style="color:#16a34a;font-weight:700;">${label("FULLY PAID", "ENTIÈREMENT PAYÉ", lang)}</span></div>` : ""}
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

  if (action === "print") {
    openReceiptPrintWindow(html);
    return;
  }

  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `deposit-receipt-order-${displayOrderId}.html`);
}

export function generateThermalDepositReceipt(order: any, symbol: string, settings: ReceiptSettings = DEFAULT_SETTINGS) {
  const lang = settings.receiptLanguage || "en";
  const displayOrderId = orderDisplayId(order);
  const customer = order.customer || {};
  const items = order.items || [];
  const garments = order.garmentItems || [];
  const entryDate = formatReceiptDate(order.entryDate || new Date(), "MMM dd, yyyy", lang);
  const subtotal = orderSubtotal(items);
  const discount = Number(order.discount || 0);
  const pickupCost = Number(order.pickupCost || 0);
  const orderTotal = orderTotalFromParts(subtotal, discount, pickupCost);
  const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const balance = Math.max(0, orderTotal - totalPaid);
  const html = buildThermalReceiptHtml({
    title: label("Thermal Receipt", "Ticket thermique", lang),
    orderId: displayOrderId,
    businessName: settings.businessName,
    contactLines: getReceiptContactLines(settings, displayOrderId, lang),
    customerName: customer.name || "",
    customerPhone: customer.phone || "",
    orderDate: entryDate,
    receiptDate: formatReceiptDate(new Date(), "MMM dd, yyyy", lang),
    items,
    garments,
    subtotal,
    discount,
    pickupCost,
    orderTotal,
    totalPaid,
    balance,
    symbol,
    footerNote: settings.receiptFooterNote || label("Thank you", "Merci", lang),
    lang,
    logoBase64: settings.logoBase64,
    showLogo: settings.showLogo,
  });
  openThermalReceiptPrintWindow(html);
}

export function printDepositReceipt(order: any, symbol: string, settings: ReceiptSettings = DEFAULT_SETTINGS) {
  generateThermalDepositReceipt(order, symbol, settings);
}

export function generateThermalPaymentReceipt(
  orderId: number | string,
  customer: any,
  items: any[],
  garments: any[],
  payment: { amount: string; method: string; date: string; newStatus: string },
  allPayments: any[],
  entryDate: string,
  discount: number,
  symbol: string,
  settings: ReceiptSettings = DEFAULT_SETTINGS,
  pickupCost: number = 0
) {
  const lang = settings.receiptLanguage || "en";
  const subtotal = orderSubtotal(items);
  const orderTotal = orderTotalFromParts(subtotal, discount, pickupCost);
  const currentPaymentAmount = Number(payment.amount || 0);
  const totalPaid = allPayments.length > 0
    ? allPayments.reduce((sum: number, paid: any) => sum + Number(paid.amount), 0)
    : currentPaymentAmount;
  const balance = Math.max(0, orderTotal - totalPaid);
  const html = buildThermalReceiptHtml({
    title: label("Thermal Payment Receipt", "Ticket paiement thermique", lang),
    orderId,
    businessName: settings.businessName,
    contactLines: getReceiptContactLines(settings, orderId, lang),
    customerName: customer?.name || "",
    customerPhone: customer?.phone || "",
    orderDate: formatReceiptDate(entryDate || new Date(), "MMM dd, yyyy", lang),
    receiptDate: formatReceiptDate(payment.date || new Date(), "MMM dd, yyyy", lang),
    items,
    garments,
    subtotal,
    discount,
    pickupCost,
    orderTotal,
    totalPaid,
    balance,
    symbol,
    footerNote: settings.receiptFooterNote || label("Thank you", "Merci", lang),
    lang,
    logoBase64: settings.logoBase64,
    showLogo: settings.showLogo,
    paymentLine: thermalMoney(currentPaymentAmount, symbol),
    methodLine: payment.method,
  });
  openThermalReceiptPrintWindow(html);
}

export function generatePaymentReceipt(
  orderId: number | string,
  customer: any,
  items: any[],
  garments: any[],
  payment: { amount: string; method: string; date: string; newStatus: string },
  allPayments: any[],
  entryDate: string,
  pickupDate: string,
  discount: number,
  symbol: string,
  settings: ReceiptSettings = DEFAULT_SETTINGS,
  pickupCost: number = 0,
  action: ReceiptAction = "download"
) {
  const lang = settings.receiptLanguage || "en";
  const displayEntryDate = formatReceiptDate(entryDate, "MMM dd, yyyy", lang);
  const displayPickupDate = formatReceiptDate(pickupDate, "MMM dd, yyyy", lang);

  const itemsHtml = items.map((item: any) => {
    const svc = item.service || {};
    const qty = item.quantity;
    const unit = serviceUnitLabel(svc.unit, lang);
    const price = Number(item.priceAtOrder);
    const lineTotal = qty * price;
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(svc.name || label("Service", "Service", lang))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty} ${unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${symbol}${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const garmentHtml = garments.length > 0 ? garments.map((g: any) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;">${g.quantity} x ${escapeHtml(g.itemName)}${g.details ? `<br><span style="font-size:10px;color:#64748b;">${escapeHtml(g.details)}</span>` : ""}</td></tr>`
  ).join("") : `<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-style:italic;">${label("No garment items recorded", "Aucun vêtement enregistré", lang)}</td></tr>`;

  const subtotalAmount = orderSubtotal(items);
  const orderTotal = orderTotalFromParts(subtotalAmount, discount, pickupCost);
  const currentPaymentAmount = Number(payment.amount || 0);
  const totalPaid = allPayments.length > 0
    ? allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    : currentPaymentAmount;
  const previousPaid = Math.max(0, totalPaid - currentPaymentAmount);
  const remaining = Math.max(0, orderTotal - totalPaid);
  const statusLabel = payment.newStatus === "paid" ? label("PAID", "PAYÉ", lang) : payment.newStatus === "partial" ? label("PARTIAL", "PARTIEL", lang) : label("UNPAID", "IMPAYÉ", lang);
  const statusColor = payment.newStatus === "paid" ? "#16a34a" : payment.newStatus === "partial" ? "#d97706" : "#dc2626";
  const statusBg = payment.newStatus === "paid" ? "#dcfce7" : payment.newStatus === "partial" ? "#fef3c7" : "#fee2e2";

  const paymentsHistoryHtml = settings.showPaymentHistory && allPayments.length > 0
    ? buildPaymentHistoryHtml(allPayments, orderTotal, symbol, lang, payment.date)
    : "";

  const contactLines = getReceiptContactLines(settings, orderId, lang);
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
    .brand { max-width: 100%; }
    .order-id-inline { margin-top: 12px; }
    .order-id-inline .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .order-id-inline .id { font-size: 28px; font-weight: 800; margin-top: 2px; }
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
      <div class="brand">
        ${headerHtml}
        <div class="order-id-inline">
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
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${label("Method", "Méthode", lang)}: ${escapeHtml(payment.method)}</div>
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
        ${pickupCost > 0 ? `<div class="summary-row"><span>${label("Transport / Delivery", "Transport / Livraison", lang)}</span><span style="color:#2563eb;">+${symbol}${pickupCost.toFixed(2)}</span></div>` : ""}
        <div class="summary-row total"><span>${label("Order Total", "Total commande", lang)}</span><span>${symbol}${orderTotal.toFixed(2)}</span></div>
        ${previousPaid > 0 ? `<div class="summary-row" style="margin-top:4px;"><span style="color:#64748b;">${label("Previously Paid", "Déjà payé", lang)}</span><span style="color:#16a34a;">-${symbol}${previousPaid.toFixed(2)}</span></div>` : ""}
        <div class="summary-row" style="margin-top:4px;"><span style="color:#64748b;">${label("This Payment", "Ce paiement", lang)}</span><span style="color:#16a34a;">-${symbol}${currentPaymentAmount.toFixed(2)}</span></div>
        ${remaining > 0 ? `<div class="summary-row" style="border-top:1px solid #fca5a5;margin-top:6px;padding-top:8px;"><span style="font-weight:700;color:#dc2626;">${label("Balance Due", "Solde dû", lang)}</span><span style="color:#dc2626;font-weight:700;">${symbol}${remaining.toFixed(2)}</span></div>` : `<div class="summary-row" style="border-top:1px solid #86efac;margin-top:6px;padding-top:8px;"><span style="font-weight:700;color:#16a34a;">${label("Balance Due", "Solde dû", lang)}</span><span style="color:#16a34a;font-weight:700;">${label("FULLY PAID", "ENTIÈREMENT PAYÉ", lang)}</span></div>`}
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

  if (action === "print") {
    openReceiptPrintWindow(html);
    return;
  }

  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `payment-receipt-order-${orderId}.html`);
}
