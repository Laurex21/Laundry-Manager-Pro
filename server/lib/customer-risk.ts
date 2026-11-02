import { calculateChurnRiskScore } from './temporal-formulas';

export type RiskHistory = { visitCount: number; avgDaysBetweenVisits: string | number | null; lastVisitAt: Date | string | null; segment: string | null; churnRiskScore: number | null };
/** Read-only projection: use the existing Analytics formula at the current instant, never the age of a stored score. */
export function currentCustomerRisk<T extends RiskHistory>(customer: T, now: Date): T & { riskHistorySufficient: boolean; atRisk: boolean } {
  const avg=Number(customer.avgDaysBetweenVisits);
  const last=customer.lastVisitAt ? new Date(customer.lastVisitAt).getTime() : NaN;
  const enough=customer.visitCount>=3 && Number.isFinite(avg) && avg>0 && Number.isFinite(last) && last<=now.getTime();
  const days=enough ? Math.floor((now.getTime()-last)/86400000) : null;
  const score=enough ? (calculateChurnRiskScore(customer.visitCount,days,avg) ?? 0) : null;
  const segment=score!=null && score>=100 ? 'lost' : score!=null && score>=55 ? 'at_risk'
    : ['at_risk','lost'].includes(customer.segment??'') ? 'regular' : customer.segment;
  return {...customer,churnRiskScore:score,segment,riskHistorySufficient:enough,atRisk:enough && score!=null && score>=55};
}

/** Public-to-the-tenant teaser: never expose names, phones, revenue or individual scores. */
export function customerFollowUpSummary(data: {churn:{atRiskCount:number}}) {
  const count=data.churn.atRiskCount;
  if(!Number.isSafeInteger(count)||count<0)throw new Error('INVALID_CUSTOMER_FOLLOW_UP_COUNT');
  return {count};
}
