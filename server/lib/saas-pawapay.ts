import { SaasError, SaasStore, type SaasInvoice } from "./saas-store";

import { PAWAPAY_ENDPOINTS, saasEnvironment, type SaasMode } from "./saas-environment";
/** Fixed provider origins; credentials never fall back between environments. */
export class SaasPawapay {
  constructor(readonly store: SaasStore, readonly token: () => string | undefined, readonly request: typeof fetch = fetch, readonly mode: SaasMode = "sandbox") {
    if (store.environment !== mode) throw new SaasError("PROVIDER_ENVIRONMENT_MISMATCH");
  }
  private async call(path: string, body?: unknown) {
    const token = this.token();
    if (!token) throw new SaasError("SANDBOX_TOKEN_NOT_CONFIGURED", 503);
    const response = await this.request(PAWAPAY_ENDPOINTS[this.mode].api + "/v2/checkouts" + path, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new SaasError("SANDBOX_PROVIDER_UNAVAILABLE", 503);
    return response.json();
  }
  private redirect(value: any, invoice: SaasInvoice) {
    let url: URL;
    try { url = new URL(value.redirectUrl); } catch { throw new SaasError("INVALID_CHECKOUT_RESPONSE", 502); }
    if (url.origin !== PAWAPAY_ENDPOINTS[this.mode].checkout || value.checkoutId !== invoice.checkout_id || typeof value.checkoutCode !== "string" || !value.checkoutCode) throw new SaasError("INVALID_CHECKOUT_RESPONSE", 502);
    return url.toString();
  }
  async start(org: number, id: string, returnUrl: string) {
    // Validate configuration before reserving an invoice; missing credentials never
    // trap the owner in a new pending checkout.
    if (!this.token()) throw new SaasError("SANDBOX_TOKEN_NOT_CONFIGURED", 503);
    const invoice = await this.store.reserveCheckout(org, id);
    if (invoice.redirect_url) return invoice;
    if (!invoice.newlyReserved) {
      try { return await this.refresh(org, id); } catch (error) {
        if (!(error instanceof SaasError) || error.code !== "CHECKOUT_NOT_FOUND_AT_PROVIDER") throw error;
        // Retry the SAME persisted UUID only after a provider NOT_FOUND.
      }
    }
    let response: any;
    try {
      response = await this.call("", {
        checkoutId: invoice.checkout_id, returnUrl, returnMethod: "INSTANT", defaultLanguage: "fr", countries: ["CMR"], expiresAfter: 15,
        amounts: [{ country: "CMR", currency: "XAF", amount: String(invoice.total_xaf) }],
        clientReferenceId: invoice.id, reason: { fr: "XpressPro abonnement", en: "XpressPro subscription" },
        metadata: [{ invoiceId: invoice.id }, { organisationId: String(org) }],
      });
    } catch { throw new SaasError("PAYMENT_AWAITING_RECONCILIATION", 503); }
    if (response.status !== "ACCEPTED") throw new SaasError("CHECKOUT_NOT_ACCEPTED", 502);
    const redirect = this.redirect(response, invoice);
    await this.store.recordCheckout(org, id, response.checkoutCode, redirect);
    return this.store.invoice(this.store.db, org, id);
  }
  async refresh(org: number, id: string) {
    const invoice = await this.store.invoice(this.store.db, org, id);
    if (!invoice.checkout_id || ["paid", "failed", "review"].includes(invoice.status)) return invoice;
    const result: any = await this.call(`/${invoice.checkout_id}`);
    if (result.status === "NOT_FOUND") throw new SaasError("CHECKOUT_NOT_FOUND_AT_PROVIDER", 404);
    if (result.status !== "FOUND" || result.data?.checkoutId !== invoice.checkout_id) throw new SaasError("PAYMENT_AWAITING_RECONCILIATION", 503);
    const event = result.data;
    if (event.clientReferenceId !== invoice.id) throw new SaasError("INVOICE_REFERENCE_MISMATCH");
    const redirect = this.redirect(event, invoice);
    if (!invoice.checkout_code) await this.store.recordCheckout(org, id, event.checkoutCode, redirect);
    await this.store.applyProviderResult(invoice.checkout_id, event, this.mode === "live" ? "pawapay_live" : "pawapay_sandbox");
    return this.store.invoice(this.store.db, org, id);
  }
}

/** Replit's preview proxy strips a nondefault public port from Host. Verify the
 * server-configured public authority, never an arbitrary forwarded header. */
export function saasCallbackAuthority(requestHost: string, configuredOrigin = process.env.SAAS_SANDBOX_CALLBACK_ORIGIN): string {
  if (!configuredOrigin) return requestHost;
  let url: URL;
  try { url = new URL(configuredOrigin); } catch { throw new SaasError("INVALID_CALLBACK_ORIGIN", 503); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new SaasError("INVALID_CALLBACK_ORIGIN", 503);
  if (![url.host, url.hostname].includes(requestHost.toLowerCase())) throw new SaasError("CALLBACK_HOST_MISMATCH", 400);
  return url.host;
}

/** Call only after validating the explicit billing configuration. */
export function configuredSaasProvider(store: SaasStore) {
  const config = saasEnvironment();
  if (!config) throw new SaasError("SAAS_DISABLED", 503);
  return new SaasPawapay(store, () => saasEnvironment()?.token, fetch, config.mode);
}

// Backwards-compatible name for isolated Sandbox fixtures.
export { SaasPawapay as SaasPawapaySandbox };
