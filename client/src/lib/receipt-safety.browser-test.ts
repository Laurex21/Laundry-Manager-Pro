import { starterReceiptSettings } from '../../../shared/starter-receipt';
import { safeReceiptDocument } from './receipt-safety';
const check=(value:unknown,label:string)=>{if(!value)throw Error(label)};
const input=`<!doctype html><html lang="fr"><head><style>.receipt {color:#123; padding:20px} td {text-align:right}</style><script>window.attack=1</script><meta http-equiv="refresh" content="0;url=https://evil.invalid"></head><body onload="window.attack=1"><main class="receipt"><h1>Reçu fictif</h1><table class="items-table"><tbody><tr><td>Amina</td><td>2,125 kg</td><td>2 125 FCFA</td></tr></tbody></table><img alt="Logo" src="data:image/png;base64,iVBORw0KGgo=" onerror="window.attack=1"><img src="javascript:alert(1)"><img src="data:image/svg+xml;base64,AAAA"><iframe srcdoc="evil"></iframe><object data="evil"></object><form action="https://evil.invalid"><input name="password"></form><a href="javascript:alert(1)">Lien</a><svg onload="alert(1)"></svg></main></body></html>`;
try {
 const logo=starterReceiptSettings<Record<string, unknown>>({}).logoBase64;
 check(safeReceiptDocument(`<img src="${logo}">`).includes(String(logo)),'trusted Starter logo preserved');
 const result=safeReceiptDocument(input);const doc=new DOMParser().parseFromString(result,'text/html');
 check(!doc.querySelector('script,iframe,object,embed,form,input,svg,a,base'),'active elements removed');
 check(!Array.from(doc.querySelectorAll('*')).some(n=>Array.from(n.attributes).some(a=>a.name.startsWith('on'))),'event handlers removed');
 check(!doc.querySelector('meta[http-equiv="refresh"]'),'redirect removed');
 check(!result.includes('javascript:')&&!result.includes('image/svg+xml'),'unsafe image protocols removed');
 check(doc.querySelector('.receipt .items-table')&&doc.body.textContent?.includes('2,125 kg')&&doc.body.textContent?.includes('2 125 FCFA'),'business values preserved');
 check(doc.querySelector('style')?.textContent?.includes('text-align:right'),'layout preserved');
 check(doc.querySelector('img[alt="Logo"]')?.getAttribute('src')?.startsWith('data:image/png'),'raster logo preserved');
 check(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')?.includes("script-src 'none'"),'restrictive CSP');
 check(safeReceiptDocument(result)===result,'repeat export stable');
 document.body.textContent='PASS — Reçus HTML : contenu actif retiré, CSP restrictive, montants, quantités, logo et styles conservés. Test isolé sans réseau ni données réelles.';
 document.body.dataset.result='pass';
}catch(e){document.body.textContent='FAIL '+String(e);document.body.dataset.result='fail';throw e;}
