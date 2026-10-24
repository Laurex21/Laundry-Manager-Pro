import assert from 'node:assert/strict';
import {currentCustomerRisk} from './customer-risk';
const now=new Date('2026-10-24T12:00:00Z');
const customer={visitCount:3,avgDaysBetweenVisits:'10',lastVisitAt:new Date('2026-10-06T12:00:00Z'),segment:'regular',churnRiskScore:0};
const copy=structuredClone(customer);
assert.equal(currentCustomerRisk(customer,now).atRisk,true,'18 days / 10-day cycle uses the Analytics 55 threshold');
assert.equal(currentCustomerRisk(customer,now).churnRiskScore,55,'stale stored score is not used');
assert.equal(currentCustomerRisk({...customer,lastVisitAt:now,segment:'lost',churnRiskScore:100},now).atRisk,false,'returned customer is not flagged by a stale segment');
for(const overrides of [{visitCount:2},{avgDaysBetweenVisits:null},{avgDaysBetweenVisits:'0'},{lastVisitAt:null},{lastVisitAt:new Date('2026-10-25')},{avgDaysBetweenVisits:'NaN'}]){
 const r=currentCustomerRisk({...customer,...overrides},now);assert.equal(r.atRisk,false);assert.equal(r.riskHistorySufficient,false);assert.equal(r.churnRiskScore,null);
}
assert.equal(currentCustomerRisk({...customer,lastVisitAt:new Date('2026-09-01')},now).churnRiskScore,100);
assert.deepEqual(customer,copy,'the projection never mutates stored customer fields');
console.log('PASS current risk: shared Analytics formula, fresh time, threshold, stale cache, insufficient history and no mutation');
