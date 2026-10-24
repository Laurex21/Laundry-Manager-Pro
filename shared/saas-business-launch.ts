import { DAY_MS, saasEffective, type SaasState } from './saas-plans';
// 1 November 2026 00:00 in Africa/Douala. The preceding minute is 31 October 23:59.
export const BUSINESS_LAUNCH_CUTOFF = '2026-10-31T23:00:00.000Z';
export function businessLaunchTrial(createdAt:Date,now:Date,sites:number[],staff:string[],protectedUntil?:Date):SaasState {
  if(!Number.isFinite(createdAt.getTime())||createdAt>now)throw Error('INVALID_LAUNCH_ACCOUNT');
  const established=now.getTime()-createdAt.getTime()>=30*DAY_MS;
  const naturalEnd=established?Date.parse(BUSINESS_LAUNCH_CUTOFF):createdAt.getTime()+30*DAY_MS;
  const end=new Date(Math.max(naturalEnd,protectedUntil?.getTime()||0));
  const extraSites=Math.max(0,sites.length-2);
  return saasEffective({plan:'business',phase:'trialing',extraSites,extraStaff:Math.max(0,staff.length-5-extraSites*2),
    trialStartedAt:createdAt.toISOString(),trialEndsAt:end.toISOString(),cycleStart:null,cycleEnd:null,anchorDay:end.getUTCDate(),
    paidBaseXaf:0,paidStaffXaf:0,paidSiteXaf:0,activeSiteIds:[...sites],activeStaffIds:[...staff],version:0,pending:null,renewal:null,
    launchBusiness:true,launchEstablished:established,protectedUntil:protectedUntil?.toISOString()??null},now);
}
export function businessTrialBanner(state:SaasState,now:Date){
  if(state.renewal||!state.launchBusiness||state.phase!=='trialing'||!state.trialEndsAt)return null;
  const ms=Date.parse(state.trialEndsAt)-now.getTime();
  if(ms<=0||(!state.launchEstablished&&ms>7*DAY_MS))return null;
  return {endsAt:state.trialEndsAt,days:Math.ceil(ms/DAY_MS),hours:Math.ceil(ms/3600000),protected:!!state.protectedUntil};
}
