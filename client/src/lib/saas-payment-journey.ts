import type { SaasQuote } from '@shared/saas-plans';
export type JourneyInvoice = {id:string;status:string;total_xaf:number;quote:SaasQuote & {durationMonths?:number;paidMonths?:number;freeMonths?:number};redirect_url:string|null;paid_at:string|null;created_at:string;checkout_code?:string|null};
export function unresolvedPayment(invoices:JourneyInvoice[] = []) {
  return invoices.find(row=>row.status==='pending'||row.status==='review')??null;
}
/** A return URL identifies an allowed invoice; it never supplies its payment status. */
export function paymentJourneyInvoice(invoices:JourneyInvoice[] = [],draft:JourneyInvoice|null=null,checkoutCode:string|null=null) {
  const unresolved=unresolvedPayment(invoices);
  if(unresolved)return unresolved;
  if(checkoutCode){const returned=invoices.find(row=>row.checkout_code===checkoutCode);if(returned)return returned;}
  return draft;
}
export function paymentJourneyStep(invoice:JourneyInvoice|null):1|2|3 {
  return !invoice?1:invoice.status==='paid'||invoice.status==='review'?3:2;
}
export function paymentBlocksNewRequest(invoice:JourneyInvoice|null) {
  return !!invoice&&(invoice.status==='pending'||invoice.status==='review');
}
