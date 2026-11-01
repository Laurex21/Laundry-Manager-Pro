import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import i18n from './i18n';
import AdminUserAccess,{adminUserAccessCopy,adminUserAccessError} from '../components/admin-user-access';
Object.assign(globalThis,{React});globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN');};
for(const language of ['fr','en']){
 await i18n.changeLanguage(language);const copy=adminUserAccessCopy(language);
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
 const items=[{id:'synthetic-owner',name:'Owner test',email:'owner@example.invalid',organisationId:1,organisationName:'Fictitious shop',role:'owner',loginType:'owner',platformAdmin:false,credentialConfigured:true,resetAllowed:true,resetBlockedReason:null,excluded:false},{id:'synthetic-excluded',name:'Excluded test',email:'excluded@example.invalid',organisationId:3,organisationName:'Excluded shop',role:'operator',loginType:'staff',platformAdmin:false,credentialConfigured:true,resetAllowed:false,resetBlockedReason:'ADMIN_USER_EXCLUDED',excluded:true}];
 function render(mode:'preview'|'production',enabled=false){client.setQueryData(['/api/platform-admin/users','all','',0],{items,total:2,limit:25,offset:0,mode,deliveryEnabled:enabled});return renderToStaticMarkup(<QueryClientProvider client={client}><AdminUserAccess/></QueryClientProvider>);}
 const preview=render('preview');assert.ok(preview.includes(copy.development));assert.ok(preview.includes(copy.preview));assert.match(preview,/owner@example.invalid/);assert.ok(preview.includes(copy.excluded));assert.match(preview,/disabled=""/);assert.doesNotMatch(preview,/passwordHash|tokenHash|resetLink/);
 const disabled=render('production');assert.ok(disabled.includes(copy.disabled));assert.doesNotMatch(disabled,new RegExp(copy.preview));
 const enabled=render('production',true);assert.ok(enabled.includes(copy.reset));assert.ok(!enabled.includes(copy.disabled));
 assert.equal(adminUserAccessError('ADMIN_RESET_REAUTH_REQUIRED',language),copy.reauth);assert.equal(adminUserAccessError('PRIVATE_PROVIDER_DETAILS',language),copy.generic);
 client.clear();
}
console.log('PASS Super Admin user access UI: FR/EN, identifiers without secrets, preview vs production delivery guard, excluded account actions disabled, safe localized errors; no network');
