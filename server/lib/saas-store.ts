import { saasOrganisationDeferred } from "./saas-deferred";
import { ProPilotStore, isProPilotInvoice } from "./saas-pro-pilot";
import { businessLaunchTrial } from "../../shared/saas-business-launch";
import { legacyLaunchProtection } from "./saas-legacy-protection";
import crypto from "node:crypto";
import { COLLECTION_PILOT_XAF, collectionPilotAllowed, isCollectionPilotInvoice } from "./saas-pilot";
import { SAAS_PLANS, SAAS_OPTION_PRICES, DAY_MS, saasTrial, saasEffective, saasQuotas, saasSelection, sameSaasSelection, saasMonthly, quoteSaas, nextSaasMonth, type SaasState, type SaasSelection, type SaasQuote } from "../../shared/saas-plans";

export interface SaasExecutor { query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number | null }> }
export interface SaasDatabase extends SaasExecutor { transaction<T>(fn: (tx: SaasExecutor) => Promise<T>): Promise<T> }
export class SaasError extends Error { constructor(readonly code: string, readonly status = 409) { super(code); } }
export type SaasInvoice = { id: string; organisation_id: number; quote: SaasQuote & { purpose?: "collection_pilot" | "subscription_pilot"; pilot?: {organisationId:number;subscriptionId:number;protectedUntil:string;grantEnd:string;fingerprint:string}; retryOf?: string }; status: string; total_xaf: number; provider_status: string | null; checkout_id: string | null; redirect_url: string | null; checkout_code: string | null; paid_at: string | null; created_at: string; newlyReserved?: boolean; };

export class SaasStore {
  constructor(readonly db: SaasDatabase, readonly clock: () => Date = () => new Date(), readonly environment: "sandbox" | "live" = "sandbox") {}
  private async log(tx: SaasExecutor, org: number, action: string, data: unknown = {}) {
    await tx.query("INSERT INTO saas_events (organisation_id, action, details) VALUES ($1,$2,$3::jsonb)", [org, action, JSON.stringify(data)]);
  }
  async ensure(org: number): Promise<void> {
    if (saasOrganisationDeferred(org)) throw new SaasError("SAAS_ORGANISATION_DEFERRED",403);
    const existing = await this.db.query("SELECT organisation_id FROM saas_accounts WHERE organisation_id=$1", [org]);
    if (existing.rows.length) return;
    await this.db.transaction(async tx => {
      const organisation = (await tx.query("SELECT id, created_at, owner_id FROM organisations WHERE id=$1 FOR UPDATE", [org])).rows[0];
      if (!organisation) throw new SaasError("ORGANISATION_NOT_FOUND", 404);
      if ((await tx.query("SELECT organisation_id FROM saas_accounts WHERE organisation_id=$1", [org])).rows.length) return;
      // Existing manually assigned/paid periods need an explicit migration decision.
      const legacy = await tx.query("SELECT id FROM subscriptions WHERE user_id=$1 AND status='active' LIMIT 1", [organisation.owner_id]);
      if (legacy.rows.length && process.env.SAAS_BUSINESS_LAUNCH_ENABLED !== "true") throw new SaasError("LEGACY_SUBSCRIPTION_REQUIRES_REVIEW");
      const sites = (await tx.query("SELECT id FROM sites WHERE organisation_id=$1 AND is_active=true ORDER BY id", [org])).rows.map(r => Number(r.id));
      const staff = await this.staffCandidates(tx, org);
      if (process.env.SAAS_BUSINESS_LAUNCH_ENABLED === "true" && legacy.rows.length) {
        const periods = (await tx.query("SELECT extract(epoch FROM end_date)*1000 AS end_milliseconds FROM subscriptions WHERE user_id=$1 AND status='active'",[organisation.owner_id])).rows;
        // Preserving only a date loses legacy unlimited/API and unused staff
        // rights. Runtime falls back to legacy access for this review error;
        // quote/checkout callers receive a refusal before creating an invoice.
        if (legacyLaunchProtection(periods, this.clock()).defer) throw new SaasError("LEGACY_SUBSCRIPTION_REQUIRES_REVIEW");
      }
      const state = process.env.SAAS_BUSINESS_LAUNCH_ENABLED === "true" ? businessLaunchTrial(new Date(organisation.created_at), this.clock(), sites, staff) : saasTrial(new Date(organisation.created_at), this.clock(), sites, staff);
      await tx.query("INSERT INTO saas_accounts (organisation_id, state) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING", [org, JSON.stringify(state)]);
      await this.log(tx, org, "trial_started", { endsAt: state.trialEndsAt });
    });
  }
  async staffCandidates(tx: SaasExecutor, org: number, siteIds?: number[]): Promise<string[]> {
    return (await tx.query(`SELECT DISTINCT u.id FROM users u JOIN site_members sm ON sm.user_id=u.id
      JOIN sites s ON s.id=sm.site_id JOIN organisations o ON o.id=s.organisation_id
      WHERE s.organisation_id=$1 AND u.organisation_id=$1 AND u.id<>o.owner_id AND s.is_active=true AND ($2::int[] IS NULL OR s.id=ANY($2::int[])) ORDER BY u.id`, [org, siteIds ?? null])).rows.map(r => r.id);
  }
  private async read(tx: SaasExecutor, org: number, lock = true): Promise<SaasState> {
    const row = (await tx.query(`SELECT state FROM saas_accounts WHERE organisation_id=$1${lock ? " FOR UPDATE" : ""}`, [org])).rows[0];
    if (!row) throw new SaasError("SAAS_NOT_INITIALISED", 503);
    const old = row.state as SaasState;
    const state = saasEffective(structuredClone(old), this.clock());
    // Keep explicit owner selection; over-quota staff always require a choice.
    if(state.launchBusiness && state.phase === "trialing") {
      state.activeSiteIds=(await tx.query("SELECT id FROM sites WHERE organisation_id=$1 AND is_active=true ORDER BY id",[org])).rows.map(r=>Number(r.id));
      state.activeStaffIds=await this.staffCandidates(tx,org,state.activeSiteIds);
      state.extraSites=Math.max(0,state.activeSiteIds.length-2);
      state.extraStaff=Math.max(0,state.activeStaffIds.length-5-state.extraSites*2);
    }
    const quotas = saasQuotas(state);
    state.activeSiteIds = state.activeSiteIds.slice(0, quotas.sites);
    const eligibleStaff = await this.staffCandidates(tx, org, state.activeSiteIds);
    state.activeStaffIds = state.activeStaffIds.filter(id => eligibleStaff.includes(id));
    if (state.activeStaffIds.length > quotas.staff) state.activeStaffIds = [];
    if (JSON.stringify(old) !== JSON.stringify(state)) {
      await this.write(tx, org, state);
      await this.log(tx, org, state.phase !== old.phase || state.cycleEnd !== old.cycleEnd ? (state.phase === "starter" ? "expired_to_starter" : "renewal_started") : "access_reconciled", { plan: state.plan });
      if (state.phase === "starter") await tx.query(`INSERT INTO saas_notices (organisation_id, notice_key, kind, details)
        VALUES ($1,$2,'expired',$3::jsonb) ON CONFLICT DO NOTHING`, [org, `expired:${old.phase === "trialing" ? old.trialEndsAt : old.cycleEnd}`, JSON.stringify({ plan: "starter" })]);
    }
    return state;
  }
  private async write(tx: SaasExecutor, org: number, state: SaasState) {
    await tx.query("UPDATE saas_accounts SET state=$2::jsonb, updated_at=now() WHERE organisation_id=$1", [org, JSON.stringify(state)]);
  }
  async current(org: number) {
    await this.ensure(org);
    return this.db.transaction(async tx => this.read(tx, org));
  }
  async createQuote(org: number, selection: SaasSelection): Promise<SaasInvoice> {
    await this.ensure(org);
    return this.db.transaction(async tx => {
      const state = await this.read(tx, org);
      const quote = quoteSaas(state, selection, this.clock());
      // One outstanding invoice prevents two different checkouts consuming the same credit.
      const open = (await tx.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND status IN ('quoted','pending','review') FOR UPDATE", [org, this.environment])).rows as SaasInvoice[];
      for (const invoice of open) {
        if (invoice.status !== "quoted" || (new Date(invoice.quote.expiresAt) > this.clock() && invoice.quote.version === state.version)) {
          if (sameSaasSelection(invoice.quote.selection, quote.selection) && invoice.status !== "review") return invoice;
          throw new SaasError("PAYMENT_ALREADY_PENDING");
        }
        await tx.query("UPDATE saas_invoices SET status='expired' WHERE id=$1", [invoice.id]);
      }

      const id = crypto.randomUUID();
      const invoice = (await tx.query(`INSERT INTO saas_invoices (id,organisation_id,quote,total_xaf,provider_environment) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *`, [id, org, JSON.stringify(quote), quote.totalXaf, this.environment])).rows[0];
      await this.log(tx, org, "quote_created", { invoiceId: id, totalXaf: quote.totalXaf });
      return invoice;
    });
  }
  /** One fixed collection attempt, independent of old/new subscription state. */
  async createCollectionPilotQuote(org: number): Promise<SaasInvoice> {
    if (this.environment !== "live" || !collectionPilotAllowed(org)) throw new SaasError("COLLECTION_PILOT_DISABLED", 404);
    return this.db.transaction(async tx => {
      if (!(await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE", [org])).rows.length) throw new SaasError("ORGANISATION_NOT_FOUND", 404);
      const previous = await tx.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND quote->>'purpose'='collection_pilot' ORDER BY (quote ? 'retryOf') DESC, created_at DESC LIMIT 1", [org, this.environment]);
      if (previous.rows.length) return previous.rows[0]; // Never create a second charge after timeout/failure/success.
      if ((await tx.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND status IN ('quoted','pending','review')", [org,this.environment])).rows.length) throw new SaasError("PAYMENT_ALREADY_PENDING");
      const now = this.clock();
      const quote: SaasInvoice["quote"] = { purpose: "collection_pilot", kind: "cycle", selection: saasSelection("starter"), version: 0,
        lines: [{label:"plan",quantity:1,amountXaf:COLLECTION_PILOT_XAF}], totalXaf: COLLECTION_PILOT_XAF, nextMonthlyXaf: 0,
        quotedAt: now.toISOString(), expiresAt: new Date(now.getTime()+15*60_000).toISOString(), cycleEnd: null };
      const invoice = (await tx.query("INSERT INTO saas_invoices (id,organisation_id,quote,total_xaf,provider_environment) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *", [crypto.randomUUID(),org,JSON.stringify(quote),COLLECTION_PILOT_XAF,this.environment])).rows[0];
      await this.log(tx,org,"collection_pilot_created",{invoiceId:invoice.id,totalXaf:COLLECTION_PILOT_XAF});
      return invoice;
    });
  }
  /** Explicit, individually authorised second pilot; never erase/reopen the failed record. */
  async retryCollectionPilotQuote(org: number, previousId: string): Promise<SaasInvoice> {
    if (!collectionPilotAllowed(org) || process.env.SAAS_LIVE_PILOT_RETRY_INVOICE_ID !== previousId) throw new SaasError("COLLECTION_RETRY_NOT_AUTHORISED",404);
    return this.db.transaction(async tx => {
      await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
      const previous=await this.invoice(tx,org,previousId,true);this.validateCollectionInvoice(previous);
      if(previous.status!=="failed" || previous.provider_status!=="FAILED" || previous.paid_at || previous.quote.retryOf) throw new SaasError("COLLECTION_RETRY_NOT_SAFE");
      const all=(await tx.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND quote->>'purpose'='collection_pilot'",[org,this.environment])).rows as SaasInvoice[];
      if(all.some(i=>i.status==="paid" || i.paid_at))throw new SaasError("COLLECTION_ALREADY_PAID");
      const child=all.find(i=>i.quote.retryOf===previousId);if(child)return child;
      if(all.length!==1 || (await tx.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND status IN ('quoted','pending','review')",[org,this.environment])).rows.length)throw new SaasError("PAYMENT_ALREADY_PENDING");
      const now=this.clock();const quote:SaasInvoice["quote"]={...previous.quote,retryOf:previousId,quotedAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60_000).toISOString()};
      const invoice=(await tx.query("INSERT INTO saas_invoices (id,organisation_id,quote,total_xaf,provider_environment) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *",[crypto.randomUUID(),org,JSON.stringify(quote),COLLECTION_PILOT_XAF,this.environment])).rows[0];
      await this.log(tx,org,"collection_pilot_retry_authorised",{invoiceId:invoice.id,retryOf:previousId,totalXaf:COLLECTION_PILOT_XAF});return invoice;
    });
  }
  private validateCollectionInvoice(invoice: SaasInvoice) {
    if (this.environment !== "live" || !isCollectionPilotInvoice(invoice) || Number(invoice.total_xaf) !== COLLECTION_PILOT_XAF ||
        invoice.quote.totalXaf !== COLLECTION_PILOT_XAF || invoice.quote.selection.plan !== "starter" || invoice.quote.selection.extraSites || invoice.quote.selection.extraStaff) throw new SaasError("COLLECTION_PILOT_MISMATCH");
  }
  private async reserveCollectionCheckout(org: number, id: string): Promise<SaasInvoice> {
    if (!collectionPilotAllowed(org)) throw new SaasError("COLLECTION_PILOT_DISABLED",404);
    return this.db.transaction(async tx => {
      await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
      const invoice=await this.invoice(tx,org,id,true); this.validateCollectionInvoice(invoice);
      if (invoice.status === "pending") return invoice;
      if (invoice.status !== "quoted") throw new SaasError("COLLECTION_PILOT_ALREADY_ATTEMPTED");
      if (new Date(invoice.quote.expiresAt) <= this.clock()) throw new SaasError("QUOTE_EXPIRED");
      return {...(await tx.query("UPDATE saas_invoices SET checkout_id=$2,status='pending' WHERE id=$1 RETURNING *",[id,crypto.randomUUID()])).rows[0],newlyReserved:true};
    });
  }
  private async applyCollectionResult(org: number, checkoutId: string, event: any, source: string) {
    // No activation/scope check here: an in-flight signed result must remain reconcilable.
    return this.db.transaction(async tx => {
      await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
      const invoice: SaasInvoice=(await tx.query("SELECT * FROM saas_invoices WHERE checkout_id=$1 AND provider_environment=$2 FOR UPDATE",[checkoutId,this.environment])).rows[0];
      this.validateCollectionInvoice(invoice);
      if (source !== "pawapay_live" || event.clientReferenceId !== invoice.id) throw new SaasError("INVOICE_REFERENCE_MISMATCH");
      const status=String(event.status || "");
      if (!["COMPLETED","FAILED","EXPIRED","CANCELLED"].includes(status)) return;
      if (event.checkoutId !== checkoutId || !invoice.checkout_code || event.checkoutCode !== invoice.checkout_code) throw new SaasError("CHECKOUT_MISMATCH");
      const moneyMatches=(v:any)=>v?.currency === "XAF" && v?.country === "CMR" && /^\d+(?:\.0+)?$/.test(String(v?.amount)) && Number(v.amount) === COLLECTION_PILOT_XAF;
      if (status === "COMPLETED" && (event.deposit?.status !== "COMPLETED" || !moneyMatches(event.deposit))) throw new SaasError("PAYMENT_MISMATCH");
      if ([event.amount,event.currency,event.country].some(v=>v!==undefined) && !moneyMatches(event)) throw new SaasError("AMOUNT_MISMATCH");
      if (event.amounts !== undefined && (!Array.isArray(event.amounts) || !event.amounts.some(moneyMatches))) throw new SaasError("AMOUNT_MISMATCH");
      if (invoice.provider_status) {
        if (invoice.provider_status !== status) throw new SaasError("CONFLICTING_FINAL_STATUS");
        return;
      }
      if (invoice.status !== "pending") throw new SaasError("INVOICE_NOT_PENDING");
      if (status === "COMPLETED") {
        await tx.query("UPDATE saas_invoices SET status='paid',provider_status='COMPLETED',paid_at=$2,payment_source=$3 WHERE id=$1",[invoice.id,this.clock().toISOString(),source]);
        await this.log(tx,org,"collection_pilot_paid",{invoiceId:invoice.id,totalXaf:COLLECTION_PILOT_XAF,subscriptionChanged:false});
      } else {
        await tx.query("UPDATE saas_invoices SET status='failed',provider_status=$2 WHERE id=$1",[invoice.id,status]);
        await this.log(tx,org,"collection_pilot_failed",{invoiceId:invoice.id,status});
      }
    });
  }
  async reserveCheckout(org: number, id: string): Promise<SaasInvoice> {
    if (saasOrganisationDeferred(org)) throw new SaasError("SAAS_ORGANISATION_DEFERRED",403);
    const candidate = await this.invoice(this.db,org,id);
    if (isProPilotInvoice(candidate)) return new ProPilotStore(this).reserve(org,id);
    if (isCollectionPilotInvoice(candidate)) return this.reserveCollectionCheckout(org,id);
    return this.db.transaction(async tx => {
      const state = await this.read(tx, org);
      const invoice = await this.invoice(tx, org, id, true);
      if (invoice.status === "pending") return invoice; // UUID saved before any outbound call.
      if (invoice.status !== "quoted" || new Date(invoice.quote.expiresAt) <= this.clock()) throw new SaasError("QUOTE_EXPIRED");
      if (invoice.quote.version !== state.version) throw new SaasError("QUOTE_STALE");
      return { ...(await tx.query("UPDATE saas_invoices SET checkout_id=$2,status='pending' WHERE id=$1 RETURNING *", [id, crypto.randomUUID()])).rows[0], newlyReserved: true };
    });
  }
  async recordCheckout(org: number, id: string, code: string, url: string) {
    await this.db.query("UPDATE saas_invoices SET checkout_code=$3,redirect_url=$4 WHERE id=$1 AND organisation_id=$2 AND provider_environment=$5 AND status IN ('pending','paid')", [id, org, code, url, this.environment]);
  }
  async invoice(tx: SaasExecutor, org: number, id: string, lock = false): Promise<SaasInvoice> {
    const row = (await tx.query(`SELECT * FROM saas_invoices WHERE id=$1 AND organisation_id=$2 AND provider_environment=$3${lock ? " FOR UPDATE" : ""}`, [id, org, this.environment])).rows[0];
    if (!row) throw new SaasError("INVOICE_NOT_FOUND", 404);
    return row;
  }
  async applyProviderResult(checkoutId: string, event: any, source: "pawapay_sandbox" | "pawapay_live" | "credit" = "pawapay_sandbox"): Promise<void> {
    if (source !== "credit" && source !== (this.environment === "live" ? "pawapay_live" : "pawapay_sandbox")) throw new SaasError("PROVIDER_ENVIRONMENT_MISMATCH");
    const found = (await this.db.query("SELECT organisation_id,quote FROM saas_invoices WHERE checkout_id=$1 AND provider_environment=$2", [checkoutId, this.environment])).rows[0];
    if (!found) throw new SaasError("CHECKOUT_NOT_FOUND", 404);
    if (isProPilotInvoice(found)) return new ProPilotStore(this).apply(Number(found.organisation_id),checkoutId,event,source);
    if (isCollectionPilotInvoice(found)) return this.applyCollectionResult(Number(found.organisation_id),checkoutId,event,source);
    await this.db.transaction(async tx => {
      const org = Number(found.organisation_id);
      // All mutations lock the account first, then invoice: consistent ordering.
      const state = await this.read(tx, org);
      const invoice: SaasInvoice = (await tx.query("SELECT * FROM saas_invoices WHERE checkout_id=$1 FOR UPDATE", [checkoutId])).rows[0];
      if (source === "credit" && invoice.total_xaf !== 0) throw new SaasError("CREDIT_INVOICE_REQUIRED");
      const status = String(event.status || "");
      if (!["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(status)) return;
      if (event.checkoutId !== checkoutId || (invoice.checkout_code && event.checkoutCode !== invoice.checkout_code)) throw new SaasError("CHECKOUT_MISMATCH");
      // Verify the successful deposit itself, not just the configured checkout amount.
      const deposit = event.deposit;
      if (status === "COMPLETED" && (!deposit || deposit.status !== "COMPLETED" || deposit.currency !== "XAF" || deposit.country !== "CMR" || !/^\d+(?:\.0+)?$/.test(String(deposit.amount)) || Number(deposit.amount) !== Number(invoice.total_xaf))) throw new SaasError("PAYMENT_MISMATCH");
      // The real Checkout callback can omit both amounts[] and root monetary
      // fields. A successful deposit above is still mandatory and checked in
      // full. Validate optional configured amounts whenever they are supplied;
      // failed/expired/cancelled checkouts never grant paid access.
      const hasRootAmount = [event.amount, event.currency, event.country].some(value => value !== undefined);
      const configured = Array.isArray(event.amounts)
        ? event.amounts.some((a: any) => a.currency === "XAF" && a.country === "CMR" && /^\d+(?:\.0+)?$/.test(String(a.amount)) && Number(a.amount) === Number(invoice.total_xaf))
        : !hasRootAmount || (event.currency === "XAF" && event.country === "CMR" && /^\d+(?:\.0+)?$/.test(String(event.amount)) && Number(event.amount) === Number(invoice.total_xaf));
      if (!configured) throw new SaasError("AMOUNT_MISMATCH");
      if (invoice.provider_status) {
        if (invoice.provider_status !== status) throw new SaasError("CONFLICTING_FINAL_STATUS");
        return;
      }
      if (invoice.status !== "pending") throw new SaasError("INVOICE_NOT_PENDING");
      if (status !== "COMPLETED") {
        await tx.query("UPDATE saas_invoices SET status='failed',provider_status=$2 WHERE id=$1", [invoice.id, status]);
        await this.log(tx, org, "payment_failed", { invoiceId: invoice.id, status });
        return;
      }
      const quote = invoice.quote;
      // Expiry transition increments version, but a late full-cycle payment is safe
      // if no other paid entitlement has replaced it. Stale credits/options are held.
      const lateCycle = (quote.kind === "cycle" || quote.kind === "renewal") && state.phase === "starter" && state.version === quote.version + 1;
      if (state.version !== quote.version && !lateCycle) {
        await tx.query("UPDATE saas_invoices SET status='review',provider_status='COMPLETED',paid_at=now() WHERE id=$1", [invoice.id]);
        await this.log(tx, org, "payment_requires_review", { invoiceId: invoice.id });
        return;
      }
      const now = this.clock();
      const target = quote.selection;
      const next = { ...state, version: state.version + 1 };
      if (quote.kind === "renewal" && (state.phase === "active" || state.phase === "trialing" && state.launchBusiness)) {
        const start = new Date(state.phase === "trialing" ? state.trialEndsAt! : state.cycleEnd!);
        next.renewal = { selection: target, start: start.toISOString(), end: nextSaasMonth(start, state.anchorDay).toISOString(),
          paidBaseXaf: SAAS_PLANS[target.plan].priceXaf, paidStaffXaf: target.extraStaff * SAAS_OPTION_PRICES.staffXaf, paidSiteXaf: target.extraSites * SAAS_OPTION_PRICES.siteXaf };
      } else if (quote.kind === "options") {
        if (state.phase !== "active" || state.cycleEnd !== quote.cycleEnd) throw new SaasError("CYCLE_CHANGED");
        Object.assign(next, target);
        // Track full-cycle equivalent seat price for a later prorated upgrade credit.
        next.paidStaffXaf = target.extraStaff * SAAS_OPTION_PRICES.staffXaf;
        next.paidSiteXaf = target.extraSites * SAAS_OPTION_PRICES.siteXaf;
      } else {
        Object.assign(next, target, { phase: "active", cycleStart: now.toISOString(), cycleEnd: nextSaasMonth(now).toISOString(), anchorDay: now.getUTCDate(),
          paidBaseXaf: SAAS_PLANS[target.plan].priceXaf, paidStaffXaf: target.extraStaff * SAAS_OPTION_PRICES.staffXaf, paidSiteXaf: target.extraSites * SAAS_OPTION_PRICES.siteXaf,
          pending: null, renewal: null });
      }
      await this.write(tx, org, next);
      await tx.query("UPDATE saas_notices SET delivered_at=now() WHERE organisation_id=$1 AND delivered_at IS NULL", [org]);
      await tx.query("UPDATE saas_invoices SET status='paid',provider_status='COMPLETED',paid_at=$2,payment_source=$3 WHERE id=$1", [invoice.id, now.toISOString(), source]);
      await this.log(tx, org, "payment_applied", { invoiceId: invoice.id, plan: target.plan, kind: quote.kind });
    });
  }
  async settleZeroInvoice(org: number, id: string) {
    const invoice = await this.invoice(this.db, org, id);
    if (invoice.total_xaf !== 0) throw new SaasError("CREDIT_INVOICE_REQUIRED");
    if (invoice.status === "paid") return invoice;
    const pending = await this.reserveCheckout(org, id);
    // Zero net balance is funded by the server-calculated credit (or a zero
    // rounded add-on), never by a browser success flag or invented cash payment.
    await this.applyProviderResult(pending.checkout_id!, { checkoutId: pending.checkout_id, status: "COMPLETED",
      amounts: [{country:"CMR",currency:"XAF",amount:"0"}], deposit: {status:"COMPLETED",country:"CMR",currency:"XAF",amount:"0"} }, "credit");
    return this.invoice(this.db, org, id);
  }
  async schedule(org: number, selection: SaasSelection) {
    saasSelection(selection.plan, selection.extraSites, selection.extraStaff);
    return this.db.transaction(async tx => {
      const state = await this.read(tx, org);
      if (state.renewal) throw new SaasError("RENEWAL_ALREADY_PAID");
      if ((await tx.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND status IN ('pending','review')", [org])).rows.length) throw new SaasError("PAYMENT_ALREADY_PENDING");
      if (state.phase !== "active" && !(state.launchBusiness && state.phase === "trialing" && selection.plan === "starter")) throw new SaasError("NO_PAID_CYCLE");
      if (saasMonthly(selection) > saasMonthly(state) || (state.plan === "pro" && selection.plan === "business")) throw new SaasError("PAYMENT_REQUIRED");
      state.pending = selection; state.version++;
      await this.write(tx, org, state); await this.log(tx, org, "change_scheduled", selection);
      return state;
    });
  }
  async selectAccess(org: number, sites: number[], staff: string[]) {
    return this.db.transaction(async tx => {
      const state = await this.read(tx, org);
      const quota = saasQuotas(state);
      if (!sites.length || new Set(sites).size !== sites.length || new Set(staff).size !== staff.length || sites.length > quota.sites || staff.length > quota.staff) throw new SaasError("QUOTA_EXCEEDED");
      const allowedSites = (await tx.query("SELECT id FROM sites WHERE organisation_id=$1 AND is_active=true", [org])).rows.map(r => Number(r.id));
      const allowedStaff = await this.staffCandidates(tx, org, sites);
      if (sites.some(id => !allowedSites.includes(id)) || staff.some(id => !allowedStaff.includes(id))) throw new SaasError("INVALID_ACCESS_SELECTION", 403);
      if ((await tx.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND status IN ('pending','review')", [org])).rows.length) throw new SaasError("PAYMENT_ALREADY_PENDING");
      state.activeSiteIds = sites; state.activeStaffIds = staff;
      await this.write(tx, org, state); await this.log(tx, org, "access_selected", { sites, staff });
      return state;
    });
  }
  async allocateSite(tx: SaasExecutor, org: number, create: () => Promise<number>) {
    const state = await this.read(tx, org);
    const quota = saasQuotas(state);
    if (state.plan !== "business" && state.activeSiteIds.length >= 1) throw new SaasError("BUSINESS_REQUIRED");
    if (!(state.launchBusiness && state.phase === "trialing") && state.activeSiteIds.length >= quota.sites) throw new SaasError("SITE_QUOTA_EXCEEDED");
    const id = await create(); state.activeSiteIds.push(id); await this.write(tx, org, state);
    return id;
  }
  async allocateStaff(tx: SaasExecutor, org: number, userId: string, siteId?: number) {
    const state = await this.read(tx, org);
    if (siteId && !state.activeSiteIds.includes(siteId)) throw new SaasError("SAAS_SITE_READ_ONLY", 403);
    const owner = (await tx.query("SELECT owner_id FROM organisations WHERE id=$1", [org])).rows[0];
    if (owner.owner_id === userId || state.activeStaffIds.includes(userId)) return;
    if (!(state.launchBusiness && state.phase === "trialing") && state.activeStaffIds.length >= saasQuotas(state).staff) throw new SaasError("STAFF_QUOTA_EXCEEDED");
    state.activeStaffIds.push(userId); await this.write(tx, org, state);
  }
  async tick(org: number, timeZone?: string) {
    await this.ensure(org);
    return this.db.transaction(async tx => {
      const state = await this.read(tx, org);
      if (timeZone) {
        try { new Intl.DateTimeFormat("en-CA", {timeZone}).format(this.clock()); state.timeZone = timeZone; await this.write(tx, org, state); } catch { /* Keep the last valid owner timezone. */ }
      }
      if (state.phase !== "trialing") return;
      const remaining = new Date(state.trialEndsAt!).getTime() - this.clock().getTime();
      if (remaining <= 7 * DAY_MS) {
        let localDate: string;
        try { localDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.timeZone || "Africa/Douala" }).format(this.clock()); } catch { localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(this.clock()); }
        await tx.query(`INSERT INTO saas_notices (organisation_id,notice_key,kind,details) VALUES ($1,$2,'trial_ending',$3::jsonb) ON CONFLICT DO NOTHING`, [org, `trial:${localDate}`, JSON.stringify({ endsAt: state.trialEndsAt })]);
      }
    });
  }
}
