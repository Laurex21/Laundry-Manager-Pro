import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Router} from 'wouter';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import i18n from './i18n';
import {accessCopy,ApiResponseError,requireOk,failureKind,historicalSite} from './access-feedback';
import {OrderIdentity} from '../components/order-identity';
import {AccessNotice} from '../components/access-notice';
import {formatExactDecimal,addDecimals} from '../../../shared/exact-decimal';
Object.assign(globalThis,{React});
globalThis.fetch=async()=>{throw Error('Network forbidden in isolated UI tests');};
for(const language of ['fr','en','pt']){
 await i18n.changeLanguage(language);
 assert.equal(formatExactDecimal('1.000000',language),'1');
 assert.equal(formatExactDecimal('1.250000',language),language==='en'?'1.25':'1,25');
 assert.equal(formatExactDecimal('0.000001',language),language==='en'?'0.000001':'0,000001');
 assert.equal(formatExactDecimal(addDecimals('0.100000','0.200000'),language),language==='en'?'0.3':'0,3');
 const number=renderToStaticMarkup(<OrderIdentity order={{id:999,orderReference:'QA-26-ABC2345',legacyOrderNumber:42}}/>);
 assert.match(number,/QA-26-ABC2345/);assert.match(number,/42<\/span>/);assert.ok(number.indexOf('QA-26-ABC2345')<number.indexOf('42</span>'));assert.doesNotMatch(number,/999/);
 const old=renderToStaticMarkup(<OrderIdentity order={{id:999,orderNumber:42}}/>);assert.equal((old.match(/42/g)||[]).length,1);
 const noSequence=renderToStaticMarkup(<OrderIdentity order={{id:999,orderReference:'QA-26-ABC2345'}}/>);assert.doesNotMatch(noSequence,/999/);
 for(const role of ['owner','operator']){
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  const user={id:'synthetic',role,currentSite:{id:11},saas:{plan:'starter',activeSiteIds:[10]},allSites:[{id:10,name:'QA active'},{id:11,name:'QA historical'}]};
  client.setQueryData(['/api/auth/user'],user);
  assert.equal(historicalSite(user),true);assert.equal(historicalSite(user,10),false);assert.equal(historicalSite({...user,saas:undefined}),false);
  const render=(child:React.ReactNode)=>renderToStaticMarkup(<Router ssrPath="/dashboard"><QueryClientProvider client={client}>{child}</QueryClientProvider></Router>);
  const historic=render(<AccessNotice kind="historical"/>);
  const premium=render(<AccessNotice error={new ApiResponseError(403,'SAAS_FEATURE_REQUIRED')}/>);
  if(role==='owner'){assert.match(historic,/subscriptions\?plan=business/);assert.ok(historic.includes(accessCopy(language).active));assert.match(premium,/subscriptions\?plan=pro/);}
  else {assert.doesNotMatch(historic,/<button|href=/);assert.doesNotMatch(premium,/href=/);assert.ok(historic.includes(accessCopy(language).owner));}
  const forbidden=render(<AccessNotice error={new ApiResponseError(403,undefined,'Forbidden')}/>);assert.doesNotMatch(forbidden,/href=/);assert.ok(forbidden.includes(accessCopy(language).forbidden));
  client.clear();
 }
}
for(const [status,code,expected] of [[403,'SAAS_SITE_READ_ONLY','historical'],[403,'SAAS_FEATURE_REQUIRED','premium'],[403,'SAAS_STAFF_SUSPENDED','suspended'],[403,undefined,'forbidden'],[401,undefined,'login'],[404,undefined,'missing'],[409,undefined,'conflict'],[400,undefined,'invalid'],[500,undefined,'failure']] as const){
 const response=new Response(JSON.stringify({code,message:'Server details'}),{status,headers:{'content-type':'application/json'}});
 await assert.rejects(requireOk(response),(error:unknown)=>error instanceof ApiResponseError && failureKind(error)===expected);
}
await assert.rejects(requireOk(new Response('<html>private internal error</html>',{status:503})),(error:unknown)=>error instanceof ApiResponseError && failureKind(error)==='failure' && !error.message.includes('private'));
await requireOk(new Response('{}',{status:200}));
console.log('PASS access feedback: exact quantities, legacy numbering, FR/EN/PT, role-aware CTAs, historical vs plan vs role vs session refusals; no network');
