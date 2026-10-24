import assert from 'node:assert/strict';
import {collectionQaAllowed,mountCollectionQaProxy}from'./collection-pilot-qa-proxy';
const safe={NODE_ENV:'development',SAAS_BILLING_MODE:'disabled',SAAS_LIVE_ENABLED:'false',XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED:'true'};
assert.equal(collectionQaAllowed(safe),true);
for(const override of [{NODE_ENV:'production'},{NODE_ENV:'test'},{SAAS_BILLING_MODE:'live'},{SAAS_LIVE_ENABLED:'true'},{XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED:'false'}]){
 const env={...safe,...override};assert.equal(collectionQaAllowed(env),false);let mounted=false;mountCollectionQaProxy({use:()=>{mounted=true;}} as any,()=>{},env);assert.equal(mounted,false);
}
let mounted=false;mountCollectionQaProxy({use:()=>{mounted=true;}}as any,()=>{},safe);assert.equal(mounted,true);
console.log('PASS isolated-copy guard: authenticated QA proxy only in paused development with real billing disabled; absent in production/live/unpaused environments');
