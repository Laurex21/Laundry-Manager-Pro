export function salesReferralUrl(code:string,origin=window.location.origin){
 const base=new URL(origin);if(base.hostname==='superadmin.xpressclean.cm')base.hostname='app.xpressclean.cm';
 return `${base.origin}/r/${encodeURIComponent(code)}`;
}
