import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {guard,tables} from './cashbook-development-schema.mjs';
const safe={NODE_ENV:'development',REPLIT_DEV_DOMAIN:'test.replit.dev',XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED:'true',SALES_EMAIL_ENABLED:'false',SAAS_LIVE_ENABLED:'false',SAAS_BILLING_MODE:'disabled',SAAS_DEFERRED_ORGANISATION_IDS:'3,100,112,193'};
test('allows guarded development only',()=>assert.doesNotThrow(()=>guard(safe)));
for(const [key,value] of Object.entries({NODE_ENV:'production',REPLIT_DEPLOYMENT:'1',REPLIT_DEV_DOMAIN:'',XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED:'false',SALES_EMAIL_ENABLED:'true',SAAS_LIVE_ENABLED:'true',SAAS_BILLING_MODE:'live',SAAS_DEFERRED_ORGANISATION_IDS:'3,100,112'}))test('rejects unsafe '+key,()=>assert.throws(()=>guard({...safe,[key]:value})));
test('all runtime cashbook SQL is schema-qualified',()=>{
 for(const f of ['cashbook-store.ts','cashbook-routes.ts','membership-routes.ts']){
 const text=readFileSync('server/lib/'+f,'utf8');for(const name of [...tables,'cashbook_capture_membership_receipt'])assert.ok(!new RegExp('(?<![\\w.])'+name+'\\b').test(text),f+' unqualified '+name);
 }
});
test('no cashbook migrations remain in publication migration root',()=>assert.equal(readdirSync('migrations').filter(f=>f.includes('cashbook')).length,0));
test('cashbook route registration still excludes production',()=>assert.match(readFileSync('server/lib/cashbook-routes.ts','utf8'),/NODE_ENV!=='development'/));
