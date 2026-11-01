import { ReplitConnectors } from '@replit/connectors-sdk';
export type SalesInvitationEmail = {to:string;representativeName:string;url:string;expiresAt:string};
export type SalesEmailDelivery = {status:'preview'|'sent';previewUrl?:string;previewText?:string};
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function invitationEmailContent(mail:SalesInvitationEmail){
 return {subject:'XpressPro — invitation à votre espace commercial',
 text:`Bonjour ${mail.representativeName},\nVous êtes invité à votre espace commercial XpressPro. Choisissez votre mot de passe avec ce lien :\n${mail.url}\nCe lien est personnel, valable 24 heures et utilisable une seule fois. Il permet uniquement de consulter votre lien et vos résultats commerciaux. Aucun accès aux commandes des pressings ou au Super Admin.\nSi vous n’attendiez pas cette invitation, ignorez ce message.`,
 html:`<p>Bonjour ${escape(mail.representativeName)},</p><p>Vous êtes invité à votre espace commercial XpressPro.</p><p><a href="${escape(mail.url)}">Choisir mon mot de passe</a></p><p>Ce lien est personnel, valable 24 heures et utilisable une seule fois. Aucun accès aux commandes des pressings ou au Super Admin.</p><p>Si vous n’attendiez pas cette invitation, ignorez ce message.</p>`};
}
export async function sendSalesInvitationEmail(mail:SalesInvitationEmail):Promise<SalesEmailDelivery>{
 const content=invitationEmailContent(mail);
 // Development must never deliver real messages, even when provider keys are present.
 if(process.env.NODE_ENV!=='production')return {status:'preview',previewUrl:mail.url,previewText:content.text};
 if(process.env.SALES_EMAIL_ENABLED!=='true')throw Error('SALES_EMAIL_NOT_CONFIGURED');
 const payload={from:process.env.SALES_EMAIL_FROM||process.env.EMAIL_FROM||'XpressPro <onboarding@resend.dev>',to:[mail.to],...content};
 const response=process.env.RESEND_API_KEY?await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)}):await new ReplitConnectors().proxy('resend','/emails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw Error('SALES_EMAIL_DELIVERY_FAILED');
 return {status:'sent'};
}
