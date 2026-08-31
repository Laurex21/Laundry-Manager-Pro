function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function money(value: unknown) { return `${Number(value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} FCFA`; }
function number(value: unknown) { return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
function usageRate(total: unknown, remaining: unknown) {
  const allowance = Number(total);
  if (!Number.isFinite(allowance) || allowance <= 0) return null;
  return Math.min(100, Math.max(0, ((allowance - Number(remaining || 0)) / allowance) * 100));
}
function businessQr(settings: any, thermal = false) {
  if (!settings?.receiptQrCodeBase64) return "";
  const size = thermal ? 76 : 92;
  const caption = settings.receiptQrCodeLabel
    ? `<div style="margin-top:5px;font-size:${thermal ? "8px" : "11px"};color:#555">${esc(settings.receiptQrCodeLabel)}</div>`
    : "";
  return `<div style="margin-top:10px;text-align:center;break-inside:avoid"><img src="${esc(settings.receiptQrCodeBase64)}" alt="QR entreprise" width="${size}" height="${size}" style="display:block;margin:auto;background:#fff;padding:3px;border:1px solid #ddd">${caption}</div>`;
}

export function generateSubscriberReceiptHTML(data: any, thermalWidth?: 58 | 80) {
  const { order, customer, subscription, plan, coverage, settings, items, garments = [], card, paymentSummary } = data;
  const thermal = !!thermalWidth;
  const width = thermal ? `${thermalWidth}mm` : "210mm";
  const receiptNumber = order.orderNumber ?? order.id;
  const kgRate = usageRate(plan.includedWeightKg, subscription.remainingKg);
  const piecesRate = usageRate(plan.includedPieces, subscription.remainingPieces);
  const ordersRate = usageRate(plan.maxOrders, subscription.remainingOrders);
  const garmentRows = garments.map((garment: any) => `<tr><td>${esc(garment.itemName)}${garment.color ? ` · ${esc(garment.color)}` : ""}</td><td class="qty">${esc(garment.quantity)}</td></tr>`).join("");
  const serviceRows = items.map((item: any) => `<tr><td>${esc(item.serviceName)}</td><td class="qty">${esc(item.quantity)}</td></tr>`).join("");
  const rateRows = [
    kgRate == null ? "" : `<div>Kg : ${number(Number(plan.includedWeightKg) - Number(subscription.remainingKg || 0))}/${number(plan.includedWeightKg)} (${number(kgRate)} %)</div>`,
    piecesRate == null ? "" : `<div>Pièces : ${number(Number(plan.includedPieces) - Number(subscription.remainingPieces || 0))}/${number(plan.includedPieces)} (${number(piecesRate)} %)</div>`,
    ordersRate == null ? "" : `<div>Commandes : ${number(Number(plan.maxOrders) - Number(subscription.remainingOrders || 0))}/${number(plan.maxOrders)} (${number(ordersRate)} %)</div>`,
  ].join("");
  const qr = card?.qrCode
    ? `<img src="${esc(card.qrCode)}" alt="QR membre" width="60" height="60" style="display:block;margin:6px auto;background:#fff;padding:3px">`
    : "";
  const extraAmount = Number(coverage.extraAmount || 0);
  const coverageStatus = extraAmount > 0
    ? `<section class="coverage extra"><strong>Supplément à payer</strong><span>${money(extraAmount)}</span></section>`
    : `<section class="coverage covered"><strong>✓ Entièrement couvert par votre abonnement</strong><span>Aucun supplément à payer</span></section>`;
  const applicableRates = [kgRate, piecesRate, ordersRate].filter((rate): rate is number => rate != null);
  const primaryRate = applicableRates.length ? Math.max(...applicableRates) : 0;
  const progressRate = Math.min(100, Math.max(0, primaryRate)).toFixed(2);
  const paymentStatus = paymentSummary?.status === "paid"
    ? { label: "Payé", className: "paid" }
    : paymentSummary?.status === "partial"
      ? { label: "Partiellement payé", className: "partial" }
    : paymentSummary?.status === "pending"
      ? { label: "En attente", className: "pending" }
      : { label: "Impayé", className: "unpaid" };
  const subscriptionCost = paymentSummary?.subscriptionCost ?? plan.recurringPrice;
  const amountPaid = Number(paymentSummary?.amountPaid ?? 0);
  const paymentDue = Number(paymentSummary?.paymentDue ?? Math.max(0, Number(subscriptionCost) - amountPaid));
  const exhaustedWarnings = [
    kgRate === 100 ? "Quota poids épuisé" : "",
    piecesRate === 100 ? "Quota pièces épuisé" : "",
    ordersRate === 100 ? "Quota commandes épuisé" : "",
  ].filter(Boolean);
  const usageWarning = exhaustedWarnings.length
    ? `<div class="usage-warning">⚠ ${exhaustedWarnings.join(" · ")}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reçu membre #${receiptNumber}</title><style>
  *{box-sizing:border-box}body{margin:0;background:${thermal ? "#fff" : "#f3f4f6"};font-family:Arial,sans-serif;color:#171717}main{width:${width};max-width:100%;margin:auto;background:#fff;padding:${thermal ? "4mm" : "14mm"};font-size:${thermal ? "9px" : "14px"}}
  header{padding:${thermal ? "8px 0" : "20px"};background:${thermal ? "#fff" : esc(settings?.receiptHeaderColor || "#8f1014")};color:${thermal ? "#000" : "#fff"};text-align:center;border-bottom:${thermal ? "1px dashed #000" : "0"}}h1{margin:6px 0}.member-badge{font-weight:800;letter-spacing:.04em}.customer{padding:12px 0;border-bottom:1px solid #ddd}.section{padding:12px 0;border-bottom:1px solid #ddd}.section-title{margin:0 0 8px;font-size:.9em;letter-spacing:.04em;text-transform:uppercase;color:${thermal ? "#000" : "#8f1014"}}table{width:100%;border-collapse:collapse}th,td{padding:4px 0;text-align:left}th{font-size:.82em;color:#555}.qty{text-align:center;width:52px}.billing{display:grid;grid-template-columns:${thermal ? "1fr" : "1fr auto"};gap:${thermal ? "4px" : "10px"};align-items:center}.billing-row{display:flex;justify-content:space-between;gap:8px}.payment-status{display:inline-block;padding:${thermal ? "0" : "4px 9px"};border-radius:999px;font-weight:800}.payment-status.paid{color:#166534;background:${thermal ? "transparent" : "#dcfce7"}}.payment-status.partial,.payment-status.pending{color:#92400e;background:${thermal ? "transparent" : "#fef3c7"}}.payment-status.unpaid{color:#991b1b;background:${thermal ? "transparent" : "#fee2e2"}}.coverage{display:flex;flex-direction:${thermal ? "column" : "row"};justify-content:space-between;gap:4px;margin:12px 0;padding:12px;border:1px solid;border-radius:${thermal ? "0" : "8px"}}.coverage span{font-size:.9em}.covered{border-color:${thermal ? "#000" : "#86c995"};background:${thermal ? "#fff" : "#f0fdf4"};color:${thermal ? "#000" : "#166534"}}.extra{border-color:#f59e0b;background:${thermal ? "#fff" : "#fffbeb"};color:#92400e}.usage{font-size:1.35em;font-weight:800}.usage-warning{margin-top:8px;padding:${thermal ? "3px 0" : "8px"};color:#991b1b;font-weight:800;background:${thermal ? "transparent" : "#fee2e2"}}.progress{height:6px;margin:8px 0;background:#e5e7eb;border-radius:999px;overflow:hidden}.progress span{display:block;height:100%;background:${primaryRate >= 100 ? "#dc2626" : "#15803d"};width:${progressRate}%}.stats{display:grid;grid-template-columns:${thermal ? "1fr" : "repeat(3,1fr)"};gap:8px}.stat{padding:${thermal ? "3px 0" : "10px"};text-align:${thermal ? "left" : "center"};border:${thermal ? "0" : "1px solid #e5e7eb"};border-radius:6px}.stat strong{display:block;font-size:1.15em}footer{text-align:center;border-top:1px dashed #999;padding-top:10px;margin-top:12px}
  </style></head><body>
  <main>
  <header>
  ${settings?.logoBase64 && !thermal ? `<img src="${esc(settings.logoBase64)}" alt="" style="max-height:48px">` : ""}
  <h1>${esc(settings?.businessName || "XpressPro")}</h1><div class="member-badge">★ REÇU MEMBRE ${esc(plan.name).toUpperCase()}</div><div>#${esc(subscription.membershipNumber)}</div>${qr}<div>Reçu #${receiptNumber} · ${new Date(order.createdAt || order.entryDate).toLocaleString("fr-FR")}</div></header>
  <section class="customer"><strong>${esc(customer.name)}</strong><br>${esc(customer.phone)}</section>
  <section class="section"><h2 class="section-title">Situation de l’abonnement</h2><div class="billing"><div class="billing-row"><span>Montant de l’abonnement</span><strong>${money(subscriptionCost)}</strong></div><div class="billing-row"><span>Montant payé</span><strong>${money(amountPaid)}</strong></div><div class="billing-row"><span>Solde restant</span><strong>${money(paymentDue)}</strong></div><div class="billing-row"><span>Statut du paiement</span><strong class="payment-status ${paymentStatus.className}">${paymentStatus.label}</strong></div></div></section>
  <section class="section"><h2 class="section-title">Services pris en charge</h2><table><thead><tr><th>Service</th><th class="qty">Qté</th></tr></thead><tbody>${serviceRows}</tbody></table></section>
  ${garmentRows ? `<section class="section"><h2 class="section-title">Vêtements enregistrés</h2><table><thead><tr><th>Article</th><th class="qty">Pièces</th></tr></thead><tbody>${garmentRows}</tbody></table></section>` : ""}
  ${coverageStatus}
  <section class="section"><h2 class="section-title">Cette commande</h2><div class="usage">${number(coverage.piecesConsumed)} pièces${Number(coverage.kgConsumed || 0) > 0 ? ` · ${number(coverage.kgConsumed)} kg` : ""}</div></section>
  <section class="section"><h2 class="section-title">Utilisation cumulée</h2>${thermal ? "" : `<div class="progress"><span></span></div>`}<div>Niveau le plus élevé : ${number(primaryRate)} %</div><div style="margin-top:7px">${rateRows || "Non applicable"}</div>${usageWarning}</section>
  <section class="section"><h2 class="section-title">Solde de votre abonnement</h2><div class="stats"><div class="stat"><strong>${subscription.remainingPieces ?? "—"}</strong>pièces restantes</div><div class="stat"><strong>${subscription.remainingOrders ?? "—"}</strong>commandes restantes</div><div class="stat"><strong>${esc(subscription.renewalDate || subscription.expiryDate)}</strong>renouvellement</div></div></section>
  <footer style="text-align:center;border-top:1px dashed #999;padding-top:10px">Merci d’être un membre fidèle.<br>À très bientôt.<br>${esc(settings?.receiptFooterNote || "")}${businessQr(settings, thermal)}</footer></main></body></html>`;
}

export function generateSubscriberThermalReceiptHTML(data: any, width: 58 | 80) {
  return generateSubscriberReceiptHTML(data, width);
}

export function generateSubscriptionPaymentReceiptHTML(data: any) {
  const { customer, subscription, plan, payment, settings, paymentPosition } = data;
  const status = data.receiptStatus ?? (paymentPosition.due <= 0 ? "Payé intégralement" : "Avance · Abonnement actif");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu de paiement abonnement #${esc(payment.id)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#171717}main{width:210mm;max-width:100%;min-height:297mm;margin:auto;background:#fff;padding:14mm}header{padding:20px;background:${esc(settings?.receiptHeaderColor || "#8f1014")};color:#fff;text-align:center}h1{margin:6px 0;font-size:24px}.subtitle{font-weight:800;letter-spacing:.04em}.section{padding:18px 0;border-bottom:1px solid #ddd}.section h2{margin:0 0 12px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#8f1014}.row{display:flex;justify-content:space-between;gap:20px;padding:6px 0}.amount{font-size:28px;font-weight:800;color:#166534}.status{display:inline-block;padding:5px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:800}.paid{background:#dcfce7;color:#166534}footer{text-align:center;border-top:1px dashed #999;padding-top:14px;margin-top:24px;color:#555}@media print{body{background:#fff}main{min-height:auto;padding:8mm}}
  </style></head><body><main><header>${settings?.logoBase64 ? `<img src="${esc(settings.logoBase64)}" alt="" style="max-height:48px">` : ""}<h1>${esc(settings?.businessName || "XpressPro")}</h1><div class="subtitle">REÇU DE PAIEMENT D’ABONNEMENT</div><div>Reçu #${esc(payment.id)} · ${new Date(payment.paymentDate).toLocaleString("fr-FR")}</div></header>
  <section class="section"><h2>Abonné</h2><div class="row"><span>Client</span><strong>${esc(customer.name)}</strong></div><div class="row"><span>Téléphone</span><strong>${esc(customer.phone)}</strong></div><div class="row"><span>N° membre</span><strong>${esc(subscription.membershipNumber)}</strong></div><div class="row"><span>Plan</span><strong>${esc(plan.name)}</strong></div></section>
  <section class="section"><h2>Paiement reçu</h2><div class="row"><span>Montant versé</span><strong class="amount">${money(payment.amount)}</strong></div><div class="row"><span>Moyen de paiement</span><strong>${esc(payment.paymentMethod || "—")}</strong></div><div class="row"><span>Référence</span><strong>${esc(payment.reference || "Aucune")}</strong></div></section>
  <section class="section"><h2>Situation après ce paiement</h2><div class="row"><span>Coût du cycle</span><strong>${money(paymentPosition.cost)}</strong></div><div class="row"><span>Total affecté</span><strong>${money(paymentPosition.paid)}</strong></div><div class="row"><span>Solde restant</span><strong>${money(paymentPosition.due)}</strong></div><div class="row"><span>Statut</span><strong class="status ${paymentPosition.due <= 0 ? "paid" : ""}">${esc(status)}</strong></div></section>
  <footer>Merci pour votre paiement.<br>${esc(settings?.receiptFooterNote || "")}${businessQr(settings)}</footer></main>
  <script>
    window.addEventListener("load", function () {
      var images = Array.prototype.slice.call(document.images || []);
      var waitForImages = images.map(function (image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      });
      Promise.all(waitForImages).then(function () {
        window.setTimeout(function () { window.print(); }, 250);
      });
    });
  </script></body></html>`;
}
