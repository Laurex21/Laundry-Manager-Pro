/** Merchant sandbox smoke check. No database import; never charges a wallet. */
import crypto from 'node:crypto';
const base = 'https://api.sandbox.pawapay.io';
if (process.env.NODE_ENV === 'production') throw new Error('REFUSED_PRODUCTION');
const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
if (!token) throw new Error('SANDBOX_TOKEN_NOT_CONFIGURED');
async function call(path: string, body?: unknown) {
  const response = await fetch(base + path, {method: body === undefined ? 'GET' : 'POST', redirect:'error', signal:AbortSignal.timeout(15_000),
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok) throw new Error(`SANDBOX_HTTP_${response.status}`);
  return response.json();
}
if (!process.argv.includes('--create-and-expire')) {
  const keys=await call('/v2/public-key/http');
  console.log(JSON.stringify({sandbox:true,publicKeysAvailable:Array.isArray(keys)?keys.length>0:!!keys,checkoutCreated:false}));
} else {
  const origin = new URL(process.env.SAAS_SANDBOX_RETURN_ORIGIN || 'http://localhost:5174');
  if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw new Error('INVALID_RETURN_ORIGIN');
  const id=crypto.randomUUID();
  const checkout=await call('/v2/checkouts',{checkoutId:id,clientReferenceId:id,amounts:[{country:'CMR',currency:'XAF',amount:'10999'}],reason:{fr:'XpressPro test',en:'XpressPro test'},returnUrl:new URL('/subscriptions',origin).href,defaultLanguage:'fr',countries:['CMR'],expiresAfter:3});
  if(checkout.checkoutId!==id||checkout.status!=='ACCEPTED'||new URL(checkout.redirectUrl).origin!=='https://checkout.sandbox.pawapay.io')throw new Error('UNEXPECTED_CHECKOUT_RESPONSE');
  const status=await call(`/v2/checkouts/${id}`);
  const expired=await call(`/v2/checkouts/${id}/expire`,{});
  console.log(JSON.stringify({sandbox:true,checkoutId:id,created:checkout.status,lookup:status.status,expired:expired.status,walletPaymentAttempted:false}));
}
