import assert from 'node:assert/strict';
import React from 'react';import{renderToStaticMarkup}from'react-dom/server';
import i18n from './i18n';import{SaasPaymentJourney,SaasPaymentStatus}from'../components/saas-payment-journey';
import{paymentJourneyInvoice,paymentJourneyStep,paymentBlocksNewRequest,type JourneyInvoice}from'./saas-payment-journey';
import type{SaasState}from'@shared/saas-plans';
Object.assign(globalThis,{React});globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN')};
const selected={plan:'pro' as const,extraSites:0,extraStaff:0};
const state:SaasState={...selected,phase:'active',trialStartedAt:null,trialEndsAt:null,cycleStart:'2026-11-02T00:00:00Z',cycleEnd:'2026-12-02T00:00:00Z',anchorDay:2,paidBaseXaf:10999,paidStaffXaf:0,paidSiteXaf:0,activeSiteIds:[999],activeStaffIds:[],version:1,pending:null};
const invoice:JourneyInvoice={id:'invoice-fictional',checkout_code:'fictional-code',status:'quoted',total_xaf:8999,redirect_url:null,paid_at:null,created_at:'2026-11-02T00:00:00Z',quote:{selection:selected,kind:'upgrade',durationMonths:1,paidMonths:1,freeMonths:0,version:1,lines:[],totalXaf:8999,nextMonthlyXaf:10999,quotedAt:'2026-11-02T00:00:00Z',expiresAt:'2026-11-03T00:00:00Z',cycleEnd:null}};
assert.equal(paymentJourneyInvoice([{...invoice,status:'paid'}],null,'status=paid'),null,'URL cannot invent success or select an unrelated paid invoice');
assert.equal(paymentJourneyStep(paymentJourneyInvoice([{...invoice,status:'pending'}],null,'fictional-code')),2,'Return code cannot turn pending into success');
assert.equal(paymentBlocksNewRequest({...invoice,status:'pending'}),true);assert.equal(paymentBlocksNewRequest({...invoice,status:'review'}),true);
assert.equal(paymentJourneyInvoice([{...invoice,status:'pending'}],{...invoice,id:'stale',status:'quoted'})?.status,'pending','Reloaded pending invoice blocks duplicate requests');
assert.equal(paymentJourneyStep({...invoice,status:'review'}),3);assert.equal(paymentJourneyStep({...invoice,status:'paid'}),3);
for(const status of ['failed','expired']){assert.equal(paymentBlocksNewRequest({...invoice,status}),false);assert.equal(paymentJourneyStep({...invoice,status}),2)}
for(const language of ['fr','en']){
 await i18n.changeLanguage(language);
 const props={selection:{...selected,plan:'business' as const},durationMonths:1 as const,invoice,state,busy:false,onRefresh(){}};
 const html=renderToStaticMarkup(<SaasPaymentJourney {...props}/>);
 assert.match(html,/Pro/);assert.doesNotMatch(html,/>Business</,'Summary uses frozen invoice plan, not an edited selector');assert.match(html,/8[\s\u202f\u00a0,]?999 FCFA/);assert.doesNotMatch(html,/54[\s\u202f\u00a0,]?995/);assert.match(html,/aria-current="step"/);
 for(const status of ['pending','review','failed','expired']){const h=renderToStaticMarkup(<SaasPaymentStatus {...props} invoice={{...invoice,status}}/>);assert.ok(!h.includes(language==='fr'?'Paiement confirmé':'Payment confirmed'));assert.ok(!h.includes(language==='fr'?'Formule active':'Active plan'));if(status==='pending'||status==='review')assert.match(h,/button/)}
 const paid=renderToStaticMarkup(<SaasPaymentStatus {...props} invoice={{...invoice,status:'paid'}}/>);assert.ok(paid.includes(language==='fr'?'Paiement confirmé':'Payment confirmed'));assert.ok(paid.includes(language==='fr'?'Formule active':'Active plan'));assert.match(paid,/2026/);
 const wrongState=renderToStaticMarkup(<SaasPaymentStatus {...props} state={{...state,plan:'business'}} invoice={{...invoice,status:'paid'}}/>);assert.ok(!wrongState.includes(language==='fr'?'Formule active':'Active plan'));
 const reserved=renderToStaticMarkup(<SaasPaymentStatus {...props} state={{...state,phase:'trialing',renewal:{selection:selected,start:'2026-11-10T00:00:00Z',end:'2026-12-10T00:00:00Z',paidBaseXaf:10999,paidStaffXaf:0,paidSiteXaf:0}}} invoice={{...invoice,status:'paid'}}/>);assert.ok(reserved.includes(language==='fr'?'réservée':'reserved'));assert.ok(!reserved.includes(language==='fr'?'Formule active':'Active plan'));
}
console.log('PASS payment journey: server-confirmed success only, scoped return-code lookup, restored pending/review duplicate guard, canonical plan/amount/duration, FR/EN, active vs reserved access; no network or real payment');
