import { campaignFromSearch } from "@shared/marketing";
import { referralSource, ACQUISITION_SESSION_MS, type AcquisitionInput } from "@shared/acquisition";
const KEY = "xpresspro.acquisition.v1";
let memory:any = null;
let pending:Promise<unknown> = Promise.resolve();
function journey():any {
  let saved = memory;
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || "null") || memory; } catch {}
  const now = Date.now();
  const utm = campaignFromSearch(window.location.search);
  const source = utm.utm_source || referralSource(document.referrer);
  const evidence = utm.utm_source ? "utm" : source ? "referrer" : "unknown";
  // A new explicit campaign starts a new attributed visit; internal navigation retains it.
  if (!saved || now-saved.updatedAt>ACQUISITION_SESSION_MS || (utm.utm_source && JSON.stringify(saved.utm)!==JSON.stringify(utm))) {
    saved = {journeyId:crypto.randomUUID(),source:source || "direct_unknown",evidence,campaign:utm.utm_campaign || "",content:utm.utm_content || "",utm};
  }
  saved.updatedAt = now; memory = saved;
  try { sessionStorage.setItem(KEY,JSON.stringify(saved)); } catch {}
  return saved;
}
export function recordAcquisition(event:string,page:string):void {
  if (event === "signup_completed") return; // The server records successful registration, never the browser.
  if (window.location.hostname !== "app.xpressclean.cm" && window.location.hostname !== "laundry-manager-pro.replit.app" && window.location.hostname !== "localhost") return;
  const saved = journey();
  const value = {eventId:crypto.randomUUID(),journeyId:saved.journeyId,consent:true,event,page,source:saved.source,evidence:saved.evidence,campaign:saved.campaign,content:saved.content} as AcquisitionInput;
  // Ordered requests ensure the server session exists before subsequent events and signup.
  pending = pending.catch(()=>{}).then(()=>fetch("/api/marketing/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value),credentials:"same-origin",keepalive:true})).catch(()=>{});
}
export function waitForAcquisition():Promise<unknown> { return Promise.race([pending,new Promise(resolve=>setTimeout(resolve,1000))]); }
export function acquisitionRegistrationConsent():Record<string,unknown> {
  try {
    if (localStorage.getItem("xpresspro.marketing-consent.v1") !== "accepted") return {};
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null") || memory;
    return saved && Date.now()-saved.updatedAt<=ACQUISITION_SESSION_MS ? {marketingConsent:true, marketingJourneyId:saved.journeyId} : {};
  } catch { return {}; }
}
export function withdrawAcquisition():void {
  memory = null;
  try { sessionStorage.removeItem(KEY); } catch {}
  // Follow any in-flight events so a late response cannot restore attribution after withdrawal.
  try { void fetch("/api/marketing/withdraw",{method:"POST",credentials:"same-origin",keepalive:true}).catch(()=>{}); } catch { /* Optional measurement never blocks withdrawal. */ }
}
