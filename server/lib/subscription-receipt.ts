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

export function generateSubscriberReceiptHTML(data: any, thermalWidth?: 58 | 80) {
  const { order, customer, subscription, plan, coverage, settings, items, garments = [], card } = data;
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
  const primaryRate = piecesRate ?? kgRate ?? ordersRate ?? 0;
  const progressRate = Math.min(100, Math.max(0, primaryRate)).toFixed(2);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reçu membre #${receiptNumber}</title><style>
  *{box-sizing:border-box}body{margin:0;background:${thermal ? "#fff" : "#f3f4f6"};font-family:Arial,sans-serif;color:#171717}main{width:${width};max-width:100%;margin:auto;background:#fff;padding:${thermal ? "4mm" : "14mm"};font-size:${thermal ? "9px" : "14px"}}
  header{padding:${thermal ? "8px 0" : "20px"};background:${thermal ? "#fff" : esc(settings?.receiptHeaderColor || "#8f1014")};color:${thermal ? "#000" : "#fff"};text-align:center;border-bottom:${thermal ? "1px dashed #000" : "0"}}h1{margin:6px 0}.member-badge{font-weight:800;letter-spacing:.04em}.customer{padding:12px 0;border-bottom:1px solid #ddd}.section{padding:12px 0;border-bottom:1px solid #ddd}.section-title{margin:0 0 8px;font-size:.9em;letter-spacing:.04em;text-transform:uppercase;color:${thermal ? "#000" : "#8f1014"}}table{width:100%;border-collapse:collapse}th,td{padding:4px 0;text-align:left}th{font-size:.82em;color:#555}.qty{text-align:center;width:52px}.coverage{display:flex;flex-direction:${thermal ? "column" : "row"};justify-content:space-between;gap:4px;margin:12px 0;padding:12px;border:1px solid;border-radius:${thermal ? "0" : "8px"}}.coverage span{font-size:.9em}.covered{border-color:${thermal ? "#000" : "#86c995"};background:${thermal ? "#fff" : "#f0fdf4"};color:${thermal ? "#000" : "#166534"}}.extra{border-color:#f59e0b;background:${thermal ? "#fff" : "#fffbeb"};color:#92400e}.usage{font-size:1.35em;font-weight:800}.progress{height:6px;margin:8px 0;background:#e5e7eb;border-radius:999px;overflow:hidden}.progress span{display:block;height:100%;background:#15803d;width:${progressRate}%}.stats{display:grid;grid-template-columns:${thermal ? "1fr" : "repeat(3,1fr)"};gap:8px}.stat{padding:${thermal ? "3px 0" : "10px"};text-align:${thermal ? "left" : "center"};border:${thermal ? "0" : "1px solid #e5e7eb"};border-radius:6px}.stat strong{display:block;font-size:1.15em}footer{text-align:center;border-top:1px dashed #999;padding-top:10px;margin-top:12px}
  </style></head><body>
  <main>
  <header>
  ${settings?.logoBase64 && !thermal ? `<img src="${esc(settings.logoBase64)}" alt="" style="max-height:48px">` : ""}
  <h1>${esc(settings?.businessName || "XpressPro")}</h1><div class="member-badge">★ REÇU MEMBRE ${esc(plan.name).toUpperCase()}</div><div>#${esc(subscription.membershipNumber)}</div>${qr}<div>Reçu #${receiptNumber} · ${new Date(order.createdAt || order.entryDate).toLocaleString("fr-FR")}</div></header>
  <section class="customer"><strong>${esc(customer.name)}</strong><br>${esc(customer.phone)}</section>
  <section class="section"><h2 class="section-title">Services pris en charge</h2><table><thead><tr><th>Service</th><th class="qty">Qté</th></tr></thead><tbody>${serviceRows}</tbody></table></section>
  ${garmentRows ? `<section class="section"><h2 class="section-title">Vêtements enregistrés</h2><table><thead><tr><th>Article</th><th class="qty">Pièces</th></tr></thead><tbody>${garmentRows}</tbody></table></section>` : ""}
  ${coverageStatus}
  <section class="section"><h2 class="section-title">Utilisation de cette commande</h2><div class="usage">${number(coverage.piecesConsumed)} pièces${Number(coverage.kgConsumed || 0) > 0 ? ` · ${number(coverage.kgConsumed)} kg` : ""}</div>${thermal ? "" : `<div class="progress"><span></span></div>`}<div>${number(primaryRate)} % de votre forfait</div><div style="margin-top:7px">${rateRows || "Non applicable"}</div></section>
  <section class="section"><h2 class="section-title">Solde de votre abonnement</h2><div class="stats"><div class="stat"><strong>${subscription.remainingPieces ?? "—"}</strong>pièces restantes</div><div class="stat"><strong>${subscription.remainingOrders ?? "—"}</strong>commandes restantes</div><div class="stat"><strong>${esc(subscription.renewalDate || subscription.expiryDate)}</strong>renouvellement</div></div></section>
  <footer style="text-align:center;border-top:1px dashed #999;padding-top:10px">Merci d’être un membre fidèle.<br>À très bientôt.<br>${esc(settings?.receiptFooterNote || "")}</footer></main></body></html>`;
}

export function generateSubscriberThermalReceiptHTML(data: any, width: 58 | 80) {
  return generateSubscriberReceiptHTML(data, width);
}
