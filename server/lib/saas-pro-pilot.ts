/** Exceptional Pro pilot. No provider call or subscription mutation on preview/quote. */
import crypto from "node:crypto";
import { SaasError, type SaasExecutor, type SaasInvoice, type SaasStore } from "./saas-store";
import { saasSelection, nextSaasMonth, SAAS_PLANS, type SaasState } from "../../shared/saas-plans";
import { pilotOrganisationAllowed } from "./saas-pilot";

export const PRO_PILOT_XAF = 50;
export const proPilotConfigured = (env: NodeJS.ProcessEnv = process.env) => env.SAAS_LIVE_PILOT_PURPOSE === "subscription_50";
export function proPilotAllowed(org: unknown, env: NodeJS.ProcessEnv = process.env) {
  return proPilotConfigured(env) && env.SAAS_BILLING_MODE === "live" && pilotOrganisationAllowed(org, env) &&
    /^[1-9]\d*$/.test(env.SAAS_PRO_PILOT_SUBSCRIPTION_ID || "") && Number.isSafeInteger(Number(env.SAAS_PRO_PILOT_SUBSCRIPTION_ID)) &&
    Number.isFinite(Date.parse(env.SAAS_PRO_PILOT_PROTECTED_UNTIL || ""));
}
export const isProPilotInvoice = (invoice: {quote?: {purpose?: string}}) => invoice.quote?.purpose === "subscription_pilot";
type Terms = { organisationId: number; subscriptionId: number; protectedUntil: string; grantEnd: string; fingerprint: string };
type ProInvoice = SaasInvoice & { quote: SaasInvoice["quote"] & { purpose: "subscription_pilot"; pilot: Terms } };
const fingerprint = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class ProPilotStore {
  constructor(readonly store: SaasStore) {}
  private allowed(org: number) {
    if(this.store.environment !== "live" || !proPilotAllowed(org)) throw new SaasError("PRO_PILOT_DISABLED",404);
  }
  private async snapshot(tx: SaasExecutor, org: number) {
    const owner = (await tx.query("SELECT id,owner_id FROM organisations WHERE id=$1",[org])).rows[0];
    if(!owner) throw new SaasError("ORGANISATION_NOT_FOUND",404);
    if((await tx.query("SELECT organisation_id FROM saas_accounts WHERE organisation_id=$1",[org])).rows.length) throw new SaasError("PRO_PILOT_EXISTING_ACCOUNT_REQUIRES_REVIEW");
    const subs = (await tx.query(`SELECT s.id,s.plan_id,s.status,s.start_date AT TIME ZONE 'UTC' AS start_date,s.end_date AT TIME ZONE 'UTC' AS end_date,p.slug,p.max_users,p.features
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=$1 AND s.status='active' ORDER BY s.id`,[owner.owner_id])).rows;
    if(subs.length!==1 || subs[0].slug!=="starter") throw new SaasError("PRO_PILOT_STARTER_REQUIRED");
    const sub=subs[0];
    if(!sub.end_date || !sub.start_date || !Number.isFinite(new Date(sub.end_date).getTime()) || !Number.isFinite(new Date(sub.start_date).getTime()) || new Date(sub.start_date)>this.store.clock() || new Date(sub.end_date)<=this.store.clock()) throw new SaasError("PRO_PILOT_PERIOD_REQUIRES_REVIEW");
    const end=new Date(sub.end_date).toISOString();
    const sites=(await tx.query("SELECT id FROM sites WHERE organisation_id=$1 AND is_active=true ORDER BY id",[org])).rows.map(r=>Number(r.id));
    const staff=await this.store.staffCandidates(tx,org,sites);
    if(sites.length!==1 || staff.length>2 || sub.max_users==null || sub.max_users>3)throw new SaasError("PRO_PILOT_RIGHTS_REQUIRES_REVIEW");
    return {ownerId:owner.owner_id,subscriptionId:Number(sub.id),protectedUntil:end,sites,staff,
      fingerprint:fingerprint({org,ownerId:owner.owner_id,sub:{...sub,start_date:new Date(sub.start_date).toISOString(),end_date:end},sites,staff})};
  }
  private terms(invoice: SaasInvoice, org: number): Terms {
    const q=invoice.quote, p=q.pilot;
    if(!isProPilotInvoice(invoice)||invoice.organisation_id!==org||invoice.total_xaf!==PRO_PILOT_XAF||q.totalXaf!==PRO_PILOT_XAF||q.nextMonthlyXaf!==SAAS_PLANS.pro.priceXaf||q.kind!=="cycle"||q.version!==0||q.selection.plan!=="pro"||q.selection.extraSites!==0||q.selection.extraStaff!==0||q.lines.length!==1||q.lines[0].label!=="plan"||q.lines[0].amountXaf!==PRO_PILOT_XAF||q.lines[0].quantity!==1||!p||p.organisationId!==org||!Number.isSafeInteger(p.subscriptionId)||p.subscriptionId<1||!/^[a-f0-9]{64}$/.test(p.fingerprint)||!Number.isFinite(Date.parse(p.protectedUntil))||p.grantEnd!==nextSaasMonth(new Date(q.quotedAt)).toISOString())throw new SaasError("PRO_PILOT_INVOICE_MISMATCH");
    return p;
  }
  private reviewed(snapshot: Awaited<ReturnType<ProPilotStore["snapshot"]>>) {
    if(snapshot.subscriptionId!==Number(process.env.SAAS_PRO_PILOT_SUBSCRIPTION_ID)||snapshot.protectedUntil!==process.env.SAAS_PRO_PILOT_PROTECTED_UNTIL)throw new SaasError("PRO_PILOT_REVIEW_CHANGED");
  }
  async current(org: number) {
    this.allowed(org);
    const invoice=(await this.store.db.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment='live' AND quote->>'purpose'='subscription_pilot' ORDER BY created_at DESC LIMIT 1",[org])).rows[0] as SaasInvoice|undefined;
    if(invoice){const terms=this.terms(invoice,org);return{amountXaf:PRO_PILOT_XAF,nextMonthlyXaf:10999,invoice,protectedUntil:terms.protectedUntil,grantEnd:nextSaasMonth(invoice.paid_at ? new Date(invoice.paid_at) : this.store.clock()).toISOString()};}
    const snapshot=await this.snapshot(this.store.db,org);this.reviewed(snapshot);
    return {amountXaf:PRO_PILOT_XAF,nextMonthlyXaf:10999,invoice:null,protectedUntil:snapshot.protectedUntil,grantEnd:nextSaasMonth(this.store.clock()).toISOString()};
  }
  async quote(org: number) {
    this.allowed(org);
    return this.store.db.transaction(async tx=>{
      await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
      const snapshot=await this.snapshot(tx,org);this.reviewed(snapshot);
      const invoices=(await tx.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment='live' AND COALESCE(quote->>'purpose','subscription')<>'collection_pilot' ORDER BY created_at DESC FOR UPDATE",[org])).rows as SaasInvoice[];
      for(const invoice of invoices){
        if(invoice.status==='paid'||invoice.paid_at)throw new SaasError("PRO_PILOT_ALREADY_PAID");
        if(isProPilotInvoice(invoice)&&invoice.status==='quoted'&&new Date(invoice.quote.expiresAt)<=this.store.clock()&&!invoice.checkout_id){await tx.query("UPDATE saas_invoices SET status='expired' WHERE id=$1",[invoice.id]);continue;}
        if(invoice.status==='expired'&&!invoice.checkout_id)continue;
        if(isProPilotInvoice(invoice)&&invoice.status==='quoted'){this.terms(invoice,org);if(invoice.quote.pilot!.fingerprint!==snapshot.fingerprint)throw new SaasError("PRO_PILOT_REVIEW_CHANGED");return invoice;}
        throw new SaasError("PRO_PILOT_PREVIOUS_ATTEMPT_REQUIRES_REVIEW");
      }
      const now=this.store.clock();const pilot:Terms={organisationId:org,subscriptionId:snapshot.subscriptionId,protectedUntil:snapshot.protectedUntil,grantEnd:nextSaasMonth(now).toISOString(),fingerprint:snapshot.fingerprint};
      const quote:ProInvoice["quote"]={purpose:"subscription_pilot",pilot,kind:"cycle",selection:saasSelection("pro"),version:0,lines:[{label:"plan",quantity:1,amountXaf:PRO_PILOT_XAF}],totalXaf:PRO_PILOT_XAF,nextMonthlyXaf:10999,quotedAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60_000).toISOString(),cycleEnd:null};
      return (await tx.query("INSERT INTO saas_invoices (id,organisation_id,quote,total_xaf,provider_environment) VALUES ($1,$2,$3::jsonb,$4,'live') RETURNING *",[crypto.randomUUID(),org,JSON.stringify(quote),PRO_PILOT_XAF])).rows[0] as SaasInvoice;
    });
  }
  async reserve(org: number,id:string) {
    this.allowed(org);
    return this.store.db.transaction(async tx=>{
      await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
      const invoice=await this.store.invoice(tx,org,id,true);const terms=this.terms(invoice,org);
      if(!['quoted','pending'].includes(invoice.status)||(invoice.status==='quoted'&&new Date(invoice.quote.expiresAt)<=this.store.clock()))throw new SaasError("QUOTE_EXPIRED");
      const snapshot=await this.snapshot(tx,org);this.reviewed(snapshot);
      if(terms.fingerprint!==snapshot.fingerprint)throw new SaasError("PRO_PILOT_REVIEW_CHANGED");
      if(invoice.status==='pending')return invoice; // Retry the same checkout UUID after revalidating the account.
      return {...(await tx.query("UPDATE saas_invoices SET checkout_id=$2,status='pending' WHERE id=$1 RETURNING *",[id,crypto.randomUUID()])).rows[0],newlyReserved:true} as SaasInvoice;
    });
  }
  async apply(org:number, checkoutId:string,event:any,source:string) {
    if(this.store.environment!=="live"||source!=="pawapay_live")throw new SaasError("PROVIDER_ENVIRONMENT_MISMATCH");
    await this.store.db.transaction(async tx=>{
      await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
      const invoice=(await tx.query("SELECT * FROM saas_invoices WHERE checkout_id=$1 AND organisation_id=$2 AND provider_environment='live' FOR UPDATE",[checkoutId,org])).rows[0] as SaasInvoice;
      if(!invoice)throw new SaasError("INVOICE_NOT_FOUND",404);
      const terms=this.terms(invoice,org),status=String(event.status||'');
      if(!['COMPLETED','FAILED','EXPIRED','CANCELLED'].includes(status))return;
      if(event.checkoutId!==checkoutId||!invoice.checkout_code||event.checkoutCode!==invoice.checkout_code||(event.clientReferenceId!==undefined&&event.clientReferenceId!==invoice.id))throw new SaasError("CHECKOUT_MISMATCH");
      const money=(v:any)=>v?.currency==='XAF'&&v?.country==='CMR'&&/^\d+(?:\.0+)?$/.test(String(v?.amount))&&Number(v.amount)===PRO_PILOT_XAF;
      if(status==='COMPLETED'&&(event.deposit?.status!=='COMPLETED'||!money(event.deposit)))throw new SaasError("PAYMENT_MISMATCH");
      if([event.amount,event.currency,event.country].some(v=>v!==undefined)&&!money(event))throw new SaasError("AMOUNT_MISMATCH");
      if(event.amounts!==undefined&&(!Array.isArray(event.amounts)||!event.amounts.some(money)))throw new SaasError("AMOUNT_MISMATCH");
      if(invoice.provider_status){if(invoice.provider_status!==status)throw new SaasError("CONFLICTING_FINAL_STATUS");return;}
      if(invoice.status!=='pending')throw new SaasError("INVOICE_NOT_PENDING");
      if(status!=='COMPLETED'){await tx.query("UPDATE saas_invoices SET status='failed',provider_status=$2 WHERE id=$1",[invoice.id,status]);return;}
      let snapshot:Awaited<ReturnType<ProPilotStore['snapshot']>>;
      try{snapshot=await this.snapshot(tx,org);if(snapshot.fingerprint!==terms.fingerprint)throw new SaasError('PRO_PILOT_REVIEW_CHANGED');}
      catch(error){if(!(error instanceof SaasError))throw error;await tx.query("UPDATE saas_invoices SET status='review',provider_status='COMPLETED',paid_at=$2 WHERE id=$1",[invoice.id,this.store.clock().toISOString()]);return;}
      const now=this.store.clock();
      const state:SaasState={...saasSelection('pro'),phase:'active',trialStartedAt:null,trialEndsAt:null,cycleStart:now.toISOString(),cycleEnd:nextSaasMonth(now).toISOString(),anchorDay:now.getUTCDate(),paidBaseXaf:PRO_PILOT_XAF,paidStaffXaf:0,paidSiteXaf:0,activeSiteIds:snapshot.sites,activeStaffIds:snapshot.staff,version:1,pending:null,renewal:null,protectedUntil:null};
      await tx.query("INSERT INTO saas_accounts (organisation_id,state) VALUES ($1,$2::jsonb)",[org,JSON.stringify(state)]);
      await tx.query("UPDATE saas_invoices SET status='paid',provider_status='COMPLETED',paid_at=$2,payment_source=$3 WHERE id=$1",[invoice.id,now.toISOString(),source]);
      await tx.query("INSERT INTO saas_events (organisation_id,action,details) VALUES ($1,'subscription_pilot_paid',$2::jsonb)",[org,JSON.stringify({invoiceId:invoice.id,amountXaf:PRO_PILOT_XAF,plan:'pro',protectedUntil:terms.protectedUntil,cycleEnd:state.cycleEnd})]);
    });
  }
}
