/** Pure rehearsal planner. Not registered in the application and never opens a database. */
import { createHash } from "node:crypto";
import { hasSaasFeature, saasQuotas, saasSelection, type SaasFeature, type SaasSelection, type SaasState } from "../../shared/saas-plans";
export type LegacySnapshot = {
  organisationId:number; ownerId:string; label:string;
  subscriptions:{id:number;status:string;planName:string;start:string|null;end:string|null}[];
  sites:number[];staff:string[];
  acquired:{sites:number|null;staff:number|null;features:string[];reviewed:boolean};
  payment:{verified:boolean;reference:string;amountXaf:number;baseXaf:number;staffXaf:number;sitesXaf:number}|null;
  hasSaasAccount:boolean;hasOpenInvoice:boolean;
};
export type LegacyDecision={target:SaasSelection;reviewer:string;reason:string};
function canonical(value:any):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  if(value && typeof value==="object")return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")}}`;
  return JSON.stringify(value);
}
export const legacyFingerprint=(snapshot:LegacySnapshot)=>createHash("sha256").update(canonical(snapshot)).digest("hex");
export const legacyReviewFingerprint=(snapshot:LegacySnapshot,decision:LegacyDecision)=>createHash("sha256").update(canonical({snapshot,decision})).digest("hex");
export function previewLegacy(snapshot:LegacySnapshot,decision:LegacyDecision,now:Date) {
  const blocked:string[]=[];const active=snapshot.subscriptions.filter(s=>s.status==="active");
  if(!Number.isSafeInteger(snapshot.organisationId)||snapshot.organisationId<1||!snapshot.ownerId)blocked.push("OWNER_OR_ORGANISATION_AMBIGUOUS");
  if(active.length!==1)blocked.push("EXACTLY_ONE_ACTIVE_PERIOD_REQUIRED");
  const period=active[0];const start=Date.parse(period?.start||"");const end=Date.parse(period?.end||"");
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||start>now.getTime())blocked.push("INVALID_PERIOD");
  if(end<=now.getTime())blocked.push("ELAPSED_PERIOD_REQUIRES_REVIEW");
  if(snapshot.hasSaasAccount)blocked.push("EXISTING_SAAS_ACCOUNT");
  if(snapshot.hasOpenInvoice)blocked.push("PAYMENT_ALREADY_PENDING");
  if(!decision.reviewer.trim()||!decision.reason.trim()||!snapshot.acquired.reviewed)blocked.push("EXPLICIT_RIGHTS_REVIEW_REQUIRED");
  let target:SaasSelection|undefined;
  try{target=saasSelection(decision.target.plan,decision.target.extraSites,decision.target.extraStaff);}catch{blocked.push("INVALID_TARGET");}
  if(new Set(snapshot.sites).size!==snapshot.sites.length||new Set(snapshot.staff).size!==snapshot.staff.length||snapshot.staff.includes(snapshot.ownerId)||!snapshot.sites.length)blocked.push("INVALID_ACCESS_SELECTION");
  if(snapshot.acquired.sites===null||snapshot.acquired.staff===null)blocked.push("UNLIMITED_RIGHTS_REQUIRE_SPECIAL_HANDLING");
  else if(target){
    const quotas=saasQuotas(target);
    if(!Number.isSafeInteger(snapshot.acquired.sites)||!Number.isSafeInteger(snapshot.acquired.staff)||snapshot.acquired.sites<1||snapshot.acquired.staff<0||quotas.sites<Math.max(snapshot.acquired.sites,snapshot.sites.length)||quotas.staff<Math.max(snapshot.acquired.staff,snapshot.staff.length))blocked.push("TARGET_WOULD_REDUCE_RIGHTS");
  }
  const known:SaasFeature[]=["receiptCustomization","reports","analytics","machines","team","memberships","multiSite"];
  if(target && snapshot.acquired.features.some(f=>!known.includes(f as SaasFeature)||!hasSaasFeature(target!.plan,f as SaasFeature)))blocked.push("FEATURES_NOT_REPRESENTABLE");
  const money=snapshot.payment;
  if(!money?.verified||!money.reference.trim())blocked.push("VERIFIED_PAYMENT_ALLOCATION_REQUIRED");
  else if([money.amountXaf,money.baseXaf,money.staffXaf,money.sitesXaf].some(n=>!Number.isSafeInteger(n)||n<0)||money.amountXaf!==money.baseXaf+money.staffXaf+money.sitesXaf)blocked.push("INCONSISTENT_PAID_ALLOCATION");
  // v5 upgrade credit supports paid Pro base + employee places only. Other
  // legacy financial shapes must not be imported as an invented credit.
  if(target && money && (target.plan==="starter"||money.sitesXaf>0&&target.plan!=="business"))blocked.push("LEGACY_CREDIT_NOT_REPRESENTABLE");
  const state:SaasState|null=blocked.length||!target||!money?null:{...target,phase:"active",trialStartedAt:null,trialEndsAt:null,cycleStart:period.start!,cycleEnd:period.end!,anchorDay:new Date(start).getUTCDate(),paidBaseXaf:money.baseXaf,paidStaffXaf:money.staffXaf,paidSiteXaf:money.sitesXaf,activeSiteIds:[...snapshot.sites],activeStaffIds:[...snapshot.staff],version:0,pending:null,renewal:null};
  return {organisationId:snapshot.organisationId,label:snapshot.label,fingerprint:legacyReviewFingerprint(snapshot,decision),status:state?"ready_for_isolated_rehearsal":"review_required",blocked,legacyPlan:period?.planName??null,target:target??null,start:period?.start??null,end:period?.end??null,remainingMilliseconds:Number.isFinite(end)?Math.max(0,end-now.getTime()):null,state,reviewer:decision.reviewer,reason:decision.reason};
}
