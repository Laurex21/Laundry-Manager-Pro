import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {salesReferralUrl} from '@/lib/sales-links';
import type {SalesRegistration,SalesRepresentative} from '@shared/sales-referrals';

async function api(path:string,body?:unknown){const r=await fetch(path,{credentials:'same-origin',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===429?'SALES_RATE_LIMIT':v.code||'SALES_UNAVAILABLE');return v;}
function resetFragment(){window.history.replaceState(null,'','/commercial');}
export default function SalesPortal(){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
 const [token,setToken]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('invite')||'');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[accepted,setAccepted]=useState(false);
 const session=useQuery<{name:string;country:string;email:string}|null>({queryKey:['sales-portal','session'],queryFn:async()=>{try{return await api('/api/sales/session');}catch(e){if((e as Error).message==='SALES_SIGN_IN_REQUIRED')return null;throw e;}},enabled:!token,retry:false,staleTime:0,refetchInterval:30000,refetchOnWindowFocus:true});
 const invitation=useQuery<{name:string;country:string;emailHint:string;expiresAt:string}>({queryKey:['sales-portal','invitation',token],queryFn:()=>api('/api/sales/invitations/inspect',{token}),enabled:!!token,retry:false,gcTime:0});
 const message=(code:string)=>code==='SALES_RATE_LIMIT'?text('Trop de tentatives. Réessayez plus tard.','Too many attempts. Try again later.'):code==='SALES_INVALID_CREDENTIALS'?text('Email ou mot de passe incorrect, ou compte suspendu.','Incorrect email or password, or suspended account.'):code==='SALES_PASSWORD_RULE'?text('Utilisez au moins 12 caractères, sans mot de passe courant, et au maximum 72 octets.','Use at least 12 characters, avoid common passwords and stay within 72 bytes.'):code==='INVALID_INVITATION'?text('Invitation expirée, déjà utilisée ou révoquée. Demandez-en une nouvelle.','Invitation expired, already used or revoked. Request a new invitation.'):text('Action indisponible. Réessayez ou contactez votre administrateur.','Action unavailable. Retry or contact your administrator.');
 async function submit(e:React.FormEvent){e.preventDefault();setError('');if(token&&password!==confirm){setError(text('Les mots de passe ne correspondent pas.','Passwords do not match.'));return;}setBusy(true);try{
  if(token){await api('/api/sales/invitations/accept',{token,password});resetFragment();setToken('');setPassword('');setConfirm('');setAccepted(true);}
  else{await api('/api/sales/login',{email,password});window.location.replace('/commercial');}
 }catch(e){setError(message((e as Error).message));}finally{setBusy(false);}}
 return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 p-4"><h1 className="font-bold">XpressPro · {text('Espace commercial','Sales portal')}</h1><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>i18n.changeLanguage(fr?'en':'fr')}>{fr?'EN':'FR'}</Button>{session.data&&!token&&<Button variant="outline" size="sm" onClick={async()=>{try{await api('/api/sales/logout',{});window.location.replace('/commercial');}catch{setError(message(''));}}}>{text('Se déconnecter','Sign out')}</Button>}</div></div></header>
  {session.data&&!token&&error&&<p role="alert" className="mx-auto max-w-5xl p-4 text-destructive">{error}</p>}
  {session.data&&!token?<SalesDashboard name={session.data.name} email={session.data.email}/>:<Card className="mx-auto mt-8 max-w-md"><CardHeader><CardTitle>{token?text('Choisir mon mot de passe','Choose my password'):text('Connexion commerciale','Sales sign in')}</CardTitle></CardHeader><CardContent className="space-y-4">
   {token&&invitation.isLoading&&<p role="status">{text('Vérification de l’invitation…','Checking invitation…')}</p>}
   {token&&invitation.error&&<p role="alert" className="text-destructive">{message((invitation.error as Error).message)}</p>}
   {token&&invitation.data&&<p>{invitation.data.name} · {invitation.data.country}<br/>{invitation.data.emailHint}<br/><span className="text-sm text-muted-foreground">{text('Ce compte donne accès uniquement à votre lien et vos résultats commerciaux.','This account only provides access to your referral link and sales results.')}</span></p>}
   {!token&&accepted&&<p role="status">{text('Mot de passe enregistré. Connectez-vous avec votre email.','Password saved. Sign in with your email.')}</p>}
   {!token&&session.isLoading&&<p role="status">{text('Vérification de la session…','Checking session…')}</p>}
   {!token&&session.error&&<p role="alert">{text('Vérification de la session impossible.','Unable to check your session.')} <button className="underline" onClick={()=>session.refetch()}>{text('Réessayer','Retry')}</button></p>}
   {(!token||invitation.data)&&<form onSubmit={submit} className="space-y-4">
    {!token&&<label className="block text-sm">Email<Input className="mt-1" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    <label className="block text-sm">{text('Mot de passe','Password')}<Input className="mt-1" type="password" autoComplete={token?'new-password':'current-password'} required minLength={token?12:1} maxLength={token?72:128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {token&&<label className="block text-sm">{text('Confirmer le mot de passe','Confirm password')}<Input className="mt-1" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="w-full" type="submit" disabled={busy}>{busy?text('Traitement…','Processing…'):token?text('Enregistrer mon mot de passe','Save my password'):text('Se connecter','Sign in')}</Button>
   </form>}
   {token?<Button variant="ghost" onClick={()=>{resetFragment();setToken('');setPassword('');setConfirm('');setError('');}}>{text('Retour à la connexion','Back to sign in')}</Button>:<p className="text-sm text-muted-foreground">{text('Accès sur invitation. Pour un mot de passe oublié, demandez une nouvelle invitation à votre administrateur.','Invitation-only access. If you forgot your password, request a new invitation from your administrator.')}</p>}
  </CardContent></Card>}
 </main>;
}
function SalesDashboard({name,email}:{name:string;email:string}){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
 const [page,setPage]=useState(1),[copied,setCopied]=useState(false);
 const summary=useQuery<{representative:SalesRepresentative;registrations:number;payments:number;paying_accounts:number;amount_xaf:number;environment:string}>({queryKey:['sales-portal','summary'],queryFn:()=>api('/api/sales/summary'),staleTime:0,refetchOnWindowFocus:true});
 const registrations=useQuery<{items:SalesRegistration[];total:number}>({queryKey:['sales-portal','registrations',page],queryFn:()=>api(`/api/sales/registrations?page=${page}`),staleTime:0,refetchOnWindowFocus:true});
 const money=(v:number)=>`${Number(v).toLocaleString(i18n.language)} FCFA (XAF)`;
 const refresh=()=>{summary.refetch();registrations.refetch();};
 return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8" data-testid="sales-own-dashboard">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-2xl font-semibold">{name}</h2><p className="text-sm text-muted-foreground">{email}</p></div><Button variant="outline" onClick={refresh}>{text('Actualiser','Refresh')}</Button></div>
  {(summary.error||registrations.error)&&<p role="alert" className="text-destructive">{text('Résultats indisponibles. Actualisez ou reconnectez-vous.','Results unavailable. Refresh or sign in again.')}</p>}
  {summary.data&&<><Card><CardHeader><CardTitle>{text('Mon lien personnel','My referral link')} · {summary.data.representative.country}</CardTitle></CardHeader><CardContent className="space-y-3"><p>{summary.data.representative.active?text('Lien actif','Active link'):text('Lien désactivé par votre administrateur.','Link disabled by your administrator.')}</p><Input readOnly aria-label={text('Mon lien personnel','My referral link')} value={salesReferralUrl(summary.data.representative.code)} onFocus={e=>e.target.select()}/><Button onClick={async()=>{try{await navigator.clipboard.writeText(salesReferralUrl(summary.data!.representative.code));setCopied(true);}catch{setCopied(false);}}}>{copied?text('Lien copié','Link copied'):text('Copier mon lien','Copy my link')}</Button></CardContent></Card>
   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[[text('Inscriptions','Registrations'),summary.data.registrations],[text('Comptes ayant payé','Paying accounts'),summary.data.paying_accounts],[text('Paiements confirmés','Confirmed payments'),summary.data.payments],[text('Montant confirmé','Confirmed amount'),money(summary.data.amount_xaf)]].map(([label,value])=><Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-xl font-semibold">{value}</p></CardContent></Card>)}</div>
   <p className="text-xs text-muted-foreground">{summary.data.environment==='test'?text('Environnement de test.','Test environment.'):text('Paiements de production confirmés.','Confirmed production payments.')} {text('Totaux cumulés depuis les inscriptions attribuées. Les pilotes et attributions gratuites sont exclus. Aucun calcul de commission.','Cumulative totals since attributed registrations. Pilots and free grants are excluded. No commission calculation.')}</p>
  </>}
  <Card><CardHeader><CardTitle>{text('Mes inscriptions et paiements','My registrations and payments')}</CardTitle></CardHeader><CardContent className="space-y-3">
   {registrations.isLoading&&<p role="status">{text('Chargement…','Loading…')}</p>}
   {registrations.data?.items.map(r=><article key={r.organisation_id} className="grid gap-2 rounded border p-3 text-sm sm:grid-cols-2"><div><p className="font-semibold">{r.business_name||text('Compte sans nom','Unnamed account')}</p><p>{text('Inscription','Signup')} : {new Date(r.created_at).toLocaleDateString(i18n.language)}</p></div><div><p>{r.payments} {text('paiement(s) confirmé(s)','confirmed payment(s)')} · {money(r.amount_xaf)}</p><p className="text-muted-foreground">{text('Dernier paiement','Last payment')} : {r.last_paid_at?new Date(r.last_paid_at).toLocaleDateString(i18n.language):'—'}</p></div></article>)}
   {!registrations.isLoading&&!registrations.error&&!registrations.data?.items.length&&<p>{text('Aucune inscription attribuée pour le moment.','No attributed registrations yet.')}</p>}
   {!!registrations.data?.total&&<div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}>{text('Précédent','Previous')}</Button><span>{page} / {Math.ceil(registrations.data.total/25)}</span><Button variant="outline" disabled={page*25>=registrations.data.total} onClick={()=>setPage(page+1)}>{text('Suivant','Next')}</Button></div>}
  </CardContent></Card>
 </div>;
}
