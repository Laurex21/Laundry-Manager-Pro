function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function canonicalReceiptMoney(value: unknown) {
  const raw = String(value ?? "0.00");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) return "0.00";
  const [whole, fraction = ""] = raw.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
function money(value: unknown) { return `${canonicalReceiptMoney(value)} FCFA`; }
function number(value: unknown) { return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
function usageRate(total: unknown, remaining: unknown) {
  const allowance = Number(total);
  if (!Number.isFinite(allowance) || allowance <= 0) return null;
  return Math.min(100, Math.max(0, ((allowance - Number(remaining || 0)) / allowance) * 100));
}

export function generateSubscriberReceiptHTML(data: any, thermalWidth?: 58 | 80) {
  const { order, customer, subscription, plan, coverage, settings, items, garments = [], stainTreatments = [], card } = data;
  const thermal = !!thermalWidth;
  const width = thermal ? `${thermalWidth}mm` : "210mm";
  const receiptNumber = order.orderNumber ?? order.id;
  const kgRate = usageRate(plan.includedWeightKg, subscription.remainingKg);
  const piecesRate = usageRate(plan.includedPieces, subscription.remainingPieces);
  const ordersRate = usageRate(plan.maxOrders, subscription.remainingOrders);
  const garmentRows = garments.map((garment: any) => `<tr><td style="padding:4px 0">${esc(garment.itemName)}${garment.color ? ` · ${esc(garment.color)}` : ""}</td><td align="center">${esc(garment.quantity)}</td></tr>`).join("");
  const treatmentRows = stainTreatments.map((treatment: any) => {
    const history = (treatment.adjustments || []).map((adjustment: any) => `<tr><td style="padding:3px 0 3px 12px">↳ ${adjustment.action === "void" ? "Annulé" : "Ajustement"}: ${esc(adjustment.reason)}</td><td align="center">${esc(adjustment.quantityEffect)} ${esc(treatment.unit)}</td><td></td><td align="right">${money(adjustment.amountEffect)}</td></tr>`).join("");
    return `<tr><td style="padding:5px 0">${esc(treatment.level)} stain treatment${treatment.level === "very_intensive" ? `<br><small>Very intensive stain treatment: removal is not guaranteed (${esc(treatment.acknowledgementTextVersion)})</small>` : ""}</td><td align="center">${esc(treatment.quantity)} ${esc(treatment.unit)}</td><td align="right">${money(treatment.capturedRate)}</td><td align="right">${money(treatment.lineTotal)}</td></tr>${history}`;
  }).join("");
  const rateRows = [
    kgRate == null ? "" : `<div>Kg : ${number(Number(plan.includedWeightKg) - Number(subscription.remainingKg || 0))}/${number(plan.includedWeightKg)} (${number(kgRate)} %)</div>`,
    piecesRate == null ? "" : `<div>Pièces : ${number(Number(plan.includedPieces) - Number(subscription.remainingPieces || 0))}/${number(plan.includedPieces)} (${number(piecesRate)} %)</div>`,
    ordersRate == null ? "" : `<div>Commandes : ${number(Number(plan.maxOrders) - Number(subscription.remainingOrders || 0))}/${number(plan.maxOrders)} (${number(ordersRate)} %)</div>`,
  ].join("");
  const qr = card?.qrCode
    ? `<img src="${esc(card.qrCode)}" alt="QR membre" width="60" height="60" style="display:block;margin:6px auto;background:#fff;padding:3px">`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reçu membre #${receiptNumber}</title></head>
  <body style="margin:0;background:${thermal ? "#fff" : "#f3f4f6"};font-family:Arial,sans-serif;color:#111">
  <main style="width:${width};max-width:100%;margin:auto;background:#fff;box-sizing:border-box;padding:${thermal ? "4mm" : "14mm"};font-size:${thermal ? "9px" : "14px"}">
  <header style="padding:${thermal ? "8px 0" : "20px"};background:${thermal ? "#fff" : esc(settings?.receiptHeaderColor || "#0D1B4B")};color:${thermal ? "#000" : "#fff"};text-align:center;border-bottom:${thermal ? "1px dashed #000" : "0"}">
  ${settings?.logoBase64 && !thermal ? `<img src="${esc(settings.logoBase64)}" alt="" style="max-height:48px">` : ""}
  <h1 style="margin:6px 0">${esc(settings?.businessName || "XpressPro")}</h1><div style="font-weight:800">★ MEMBRE ${esc(plan.name).toUpperCase()}</div><div>#${esc(subscription.membershipNumber)}</div>${qr}<div>Reçu #${receiptNumber} · ${new Date(order.createdAt || order.entryDate).toLocaleString("fr-FR")}</div></header>
  <section style="padding:12px 0;border-bottom:1px solid #ddd"><strong>${esc(customer.name)}</strong><br>${esc(customer.phone)}</section>
  <table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr><th align="left">Service</th><th>Qté</th><th align="right">Tarif</th><th align="right">Total</th></tr></thead><tbody>${items.map((x: any) => `<tr><td style="padding:5px 0">${esc(x.serviceName)}</td><td align="center">${esc(x.quantity)}</td><td></td><td align="right">${money(x.lineTotal)}</td></tr>`).join("")}${treatmentRows}</tbody></table>
  ${garmentRows ? `<section style="padding:10px 0;border-top:1px solid #ddd"><strong>Vêtements enregistrés</strong><table style="width:100%;border-collapse:collapse;margin-top:5px"><thead><tr><th align="left">Article</th><th>Pièces</th></tr></thead><tbody>${garmentRows}</tbody></table></section>` : ""}
  <section style="border:${thermal ? "1px dashed #000" : "1px solid #bfdbfe"};padding:12px"><div style="display:flex;justify-content:space-between"><span>Montant total commande</span><strong>${money(order.originalPrice ?? order.totalAmount)}</strong></div><div style="display:flex;justify-content:space-between"><span>✓ Couvert par l’abonnement</span><strong>- ${money(coverage.coveredAmount)}</strong></div><div style="display:flex;justify-content:space-between;font-size:1.15em;margin-top:8px"><span>Montant à payer</span><strong>${money(coverage.extraAmount)}</strong></div></section>
  <section style="padding:12px 0;border-bottom:1px solid #ddd"><strong>Forfait actuel : ${esc(plan.name)}</strong><div>Cycle : ${esc(plan.billingCycle)} · Valable jusqu’au ${esc(subscription.expiryDate)}</div><div style="margin-top:7px"><strong>Consommation de cette commande</strong><div>${number(coverage.kgConsumed)} kg · ${number(coverage.piecesConsumed)} pièces</div></div><div style="margin-top:7px"><strong>Taux de consommation</strong>${rateRows || "<div>Non applicable</div>"}</div></section>
  <section style="padding:12px 0"><strong>Solde restant abonnement</strong><div>${subscription.remainingKg ?? "—"} kg · ${subscription.remainingPieces ?? "—"} pièces · ${subscription.remainingOrders ?? "—"} commandes</div><div>Prochain renouvellement : ${esc(subscription.renewalDate || subscription.expiryDate)}</div><div style="margin-top:8px">Économies réalisées aujourd’hui : <strong>${money(coverage.savingsAchieved)}</strong></div></section>
  <footer style="text-align:center;border-top:1px dashed #999;padding-top:10px">Merci d’être un membre fidèle.<br>À très bientôt.<br>${esc(settings?.receiptFooterNote || "")}</footer></main></body></html>`;
}

export function generateSubscriberThermalReceiptHTML(data: any, width: 58 | 80) {
  return generateSubscriberReceiptHTML(data, width);
}
