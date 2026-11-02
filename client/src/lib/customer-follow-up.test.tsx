import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Router} from 'wouter';
import i18n from './i18n';
import {CustomerFollowUpNotice,CustomerFollowUpList,followUpPage,CUSTOMER_FOLLOW_UP_URL} from '../components/customer-follow-up-notice';
import {customerFollowUpSummary} from '../../../server/lib/customer-risk';
Object.assign(globalThis,{React});globalThis.fetch=async()=>{throw Error('NO_NETWORK')};
const rows=Array.from({length:47},(_,id)=>({id:id+1,name:`Fictional customer ${id+1}`,lastVisitAt:null,avgDaysBetweenVisits:10}));
assert.deepEqual([0,1,2].flatMap(p=>followUpPage(rows,p).rows).map(c=>c.id),rows.map(c=>c.id),'Every matching customer is reachable without truncation');
assert.equal(followUpPage(rows,99).current,2);assert.equal(followUpPage([],99).rows.length,0);
assert.deepEqual(customerFollowUpSummary({churn:{atRiskCount:47,customers:rows,revenueAtRisk:123} } as any),{count:47});
assert.throws(()=>customerFollowUpSummary({churn:{atRiskCount:NaN}}));
for(const lang of ['fr','en']){
 await i18n.changeLanguage(lang);const hook=()=>['/dashboard',()=>{}] as [string,(to:string)=>void];
 const render=(node:React.ReactNode)=>renderToStaticMarkup(<Router hook={hook}>{node}</Router>);
 const starter=render(<CustomerFollowUpNotice count={47} canAnalyze={false}/>);
 assert.ok(starter.includes('47'));assert.ok(starter.includes('/subscriptions?plan=pro'));assert.ok(!starter.includes('Fictional customer'));assert.ok(!starter.includes(CUSTOMER_FOLLOW_UP_URL));
 const paid=render(<CustomerFollowUpNotice count={47} canAnalyze/>);assert.ok(paid.includes(CUSTOMER_FOLLOW_UP_URL.replaceAll('&','&amp;')));assert.ok(!paid.includes('/subscriptions'));
 assert.equal(render(<CustomerFollowUpNotice count={0} canAnalyze={false}/>),'');
 const list=render(<CustomerFollowUpList customers={rows}/>);assert.ok(list.includes('1–20'));assert.ok(list.includes('/customers/20'));assert.ok(list.includes(lang==='fr'?'Suivant':'Next'));
}
console.log('PASS customer follow-up: Starter count-only teaser, paid direct customer view, FR/EN, all 47 results reachable, empty/error counts, scoped privacy projection; no network');
