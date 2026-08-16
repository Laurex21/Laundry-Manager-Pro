import assert from "node:assert/strict";
import { generateSubscriberReceiptHTML } from "./subscription-receipt";

const base = {
  order: { id: 211, createdAt: "2026-08-10T16:06:00Z" },
  customer: { name: "M Omer", phone: "+237675088116" },
  subscription: { membershipNumber: "XP-276", remainingPieces: 175, remainingOrders: 199, expiryDate: "2028-08-09" },
  plan: { name: "Premium", billingCycle: "annual", recurringPrice: 36000, includedPieces: 200, maxOrders: 200 },
  settings: { businessName: "Monsieur propre pressing" },
  items: [{ serviceName: "T-shirt", quantity: 2, unitPrice: 5000 }],
  garments: [{ itemName: "T-shirt", quantity: 2, color: "white" }],
  coverage: { coveredAmount: 10000, extraAmount: 0, savingsAchieved: 10000, piecesConsumed: 2, kgConsumed: 0 },
  paymentSummary: { status: "paid", subscriptionCost: 36000, amountPaid: 36000, paymentDue: 0 },
};

const covered = generateSubscriberReceiptHTML(base);
assert.match(covered, /Services pris en charge/);
assert.match(covered, /Entièrement couvert par votre abonnement/);
assert.match(covered, /T-shirt · white/);
assert.doesNotMatch(covered, /5[\s\u202f]?000/);
assert.doesNotMatch(covered, /10[\s\u202f]?000/);
assert.match(covered, /Montant de l’abonnement/);
assert.match(covered, /36[\s\u202f]?000,00 FCFA/);
assert.match(covered, /Statut du paiement/);
assert.match(covered, /Payé/);
assert.match(covered, /width:12\.50%/);
assert.match(covered, /Cette commande/);
assert.match(covered, /2 pièces/);
assert.match(covered, /Utilisation cumulée/);

const extra = generateSubscriberReceiptHTML({ ...base, coverage: { ...base.coverage, extraAmount: 1500 } }, 80);
assert.match(extra, /Supplément à payer/);
assert.match(extra, /1[\s\u202f]?500,00 FCFA/);
assert.doesNotMatch(extra, /Entièrement couvert par votre abonnement/);

const pending = generateSubscriberReceiptHTML({ ...base, paymentSummary: { status: "pending" } }, 58);
assert.match(pending, /En attente/);

const unpaid = generateSubscriberReceiptHTML({ ...base, paymentSummary: { status: "unpaid" } });
assert.match(unpaid, /Impayé/);

const partial = generateSubscriberReceiptHTML({
  ...base,
  subscription: { ...base.subscription, remainingPieces: 125 },
  paymentSummary: { status: "partial", subscriptionCost: 36000, amountPaid: 10000, paymentDue: 26000 },
});
assert.match(partial, /Partiellement payé/);
assert.match(partial, /Montant payé/);
assert.match(partial, /10[\s\u202f]?000,00 FCFA/);
assert.match(partial, /Solde restant/);
assert.match(partial, /26[\s\u202f]?000,00 FCFA/);

const exhaustedWeight = generateSubscriberReceiptHTML({
  ...base,
  subscription: { ...base.subscription, remainingPieces: 125, remainingKg: 0 },
  plan: { ...base.plan, includedWeightKg: 30 },
  coverage: { ...base.coverage, piecesConsumed: 7, kgConsumed: 10 },
});
assert.match(exhaustedWeight, /Cette commande[^]*7 pièces · 10 kg/);
assert.match(exhaustedWeight, /Utilisation cumulée/);
assert.match(exhaustedWeight, /Kg : 30\/30 \(100 %\)/);
assert.match(exhaustedWeight, /Pièces : 75\/200 \(37,5 %\)/);
assert.match(exhaustedWeight, /Quota poids épuisé/);
assert.match(exhaustedWeight, /width:100\.00%/);

console.log("subscriber receipt design regression tests passed");
