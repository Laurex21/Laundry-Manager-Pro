import {useState,useEffect} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Button} from './ui/button';
import {Input} from './ui/input';

type AccountState={account:null|{id:string;email:string;active:boolean;has_password:boolean;activated_at:string|null};invitation:null|{delivery_status:string;expires_at:string;used_at:string|null;revoked_at:string|null}};
async function request(path:string,options?:RequestInit){const r=await fetch(path,{credentials:'same-origin',...options});const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body.code||'SALES_UNAVAILABLE');return body;}
export function SalesAccountAccess({representativeId,name}:{representativeId:number;name:string}){
 const fr=useTranslation().i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
 const [open,setOpen]=useState(false),[email,setEmail]=useState('');const client=useQueryClient();
 const state=useQuery<AccountState>({queryKey:['sales-access',representativeId],queryFn:()=>request(`/api/platform-admin/sales/${representativeId}/account`),enabled:open,staleTime:0});
 useEffect(()=>{if(state.data?.account?.email)setEmail(state.data.account.email);},[state.data?.account?.email]);
 const invite=useMutation<{status:string;previewUrl?:string;previewText?:string},Error>({mutationFn:()=>request(`/api/platform-admin/sales/${representativeId}/invitation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}),onSuccess:()=>client.invalidateQueries({queryKey:['sales-access',representativeId]})});
 const change=useMutation({mutationFn:()=>request(`/api/platform-admin/sales/${representativeId}/account`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!state.data?.account?.active})}),onSuccess:()=>client.invalidateQueries({queryKey:['sales-access',representativeId]})});
 const a=state.data?.account,inv=state.data?.invitation;
 const error=invite.error||change.error;
 return <div className="rounded-lg border bg-muted/20 p-3" data-testid={`sales-access-${representativeId}`}>
  <Button size="sm" variant="outline" onClick={()=>setOpen(!open)} aria-expanded={open}>{text('Compte de connexion','Login account')} · {name}</Button>
  {open&&<div className="mt-3 space-y-3">
   {state.isLoading&&<p role="status">{text('Chargement…','Loading…')}</p>}
   {state.error&&<p role="alert">{text('Accès indisponible. Vérifiez votre session Super Admin.','Access unavailable. Check your Super Admin session.')}</p>}
   {state.data&&<>
    <p className="text-sm">{a?(a.has_password?(a.active?text('Compte actif','Active account'):text('Compte suspendu','Suspended account')):text('Invitation en attente','Invitation pending')):text('Aucun compte de connexion.','No login account.')}</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();invite.mutate();}}>
     <label className="min-w-0 flex-1 text-sm">{text('Email de connexion du commercial','Representative login email')}<Input className="mt-1" type="email" required maxLength={254} value={email} readOnly={!!a?.has_password} onChange={e=>setEmail(e.target.value)} autoComplete="off"/></label>
     <Button size="sm" type="submit" disabled={invite.isPending||change.isPending}>{invite.isPending?text('Préparation…','Preparing…'):a?.has_password?text('Envoyer un lien de réinitialisation','Send reset invitation'):text('Inviter par email','Invite by email')}</Button>
    </form>
    <p className="text-xs text-muted-foreground">{text('Le destinataire choisit son mot de passe. Une nouvelle invitation invalide les précédentes. Suspendre ce compte coupe ses sessions ; son lien personnel reste inchangé.','The recipient chooses their password. A new invitation revokes earlier invitations. Suspending this account ends its sessions; its personal referral link is retained.')}</p>
    {inv&&<p className="text-xs">{text('Dernière invitation','Last invitation')} : {inv.delivery_status==='preview'?text('aperçu de développement — aucun email envoyé','development preview — no email sent'):inv.delivery_status==='sent'?text('envoyée','sent'):inv.delivery_status==='failed'?text('échec d’envoi','delivery failed'):text('en cours','pending')} · {text('expiration','expires')} {new Date(inv.expires_at).toLocaleString(fr?'fr':'en')}{inv.used_at?` · ${text('utilisée','used')}`:inv.revoked_at?` · ${text('révoquée','revoked')}`:''}</p>}
    {invite.data?.status==='sent'&&<p role="status">{text('Invitation envoyée par email.','Invitation sent by email.')}</p>}
    {invite.data?.status==='preview'&&invite.data.previewUrl&&<div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><p>{text('Mode développement : aucun email réel n’a été envoyé. Aperçu privé réservé au Super Admin.','Development mode: no real email was sent. Private preview for Super Admin only.')}</p><a className="mt-2 inline-block font-semibold underline" href={invite.data.previewUrl} target="_blank" rel="noopener noreferrer">{text('Ouvrir l’invitation de test','Open test invitation')}</a></div>}
    {!!a?.has_password&&<Button variant="outline" size="sm" disabled={change.isPending||invite.isPending} onClick={()=>change.mutate()}>{a.active?text('Suspendre le compte','Suspend account'):text('Réactiver le compte','Reactivate account')}</Button>}
    {error&&<p role="alert" className="text-sm text-destructive">{error.message==='SALES_EMAIL_DELIVERY_FAILED'?text('Envoi impossible. Vérifiez la configuration email puis réessayez. Le nouveau lien est révoqué.','Delivery failed. Check email configuration and retry. The new link is revoked.'):error.message==='EMAIL_IN_USE'?text('Cet email est déjà utilisé par un autre commercial.','This email is used by another representative.'):text('Action impossible. Vérifiez votre session et les informations saisies.','Action unavailable. Check your session and the entered details.')}</p>}
   </>}
  </div>}
 </div>;
}
