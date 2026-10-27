import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
type Row={source:string;evidence:string;campaign:string;content:string;visits:number;pageviews:number;whatsapp:number;starts:number;registrations:number};
export default function AcquisitionReport(){
 const fr=useTranslation().i18n.language.startsWith("fr");
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Douala"});
 const [start,setStart]=useState(today.slice(0,8)+"01"),[end,setEnd]=useState(today),[source,setSource]=useState("tiktok");
 const report=useQuery<{rows:Row[]}>({queryKey:["acquisition",start,end],queryFn:async()=>{
   const r=await fetch(`/api/platform-admin/acquisition?start=${start}&end=${end}`,{credentials:"same-origin"});
   if(!r.ok)throw new Error(fr?"Rapport indisponible. Vérifiez la période et votre session administrateur.":"Report unavailable. Check the period and your administrator session.");return r.json();
 },enabled:!!start&&!!end});
 const rows=(report.data?.rows||[]).filter(r=>source==="all"||r.source===source);
 const total=(key:keyof Row)=>rows.reduce((sum,r)=>sum+Number(r[key]||0),0);
 return <section className="space-y-4 rounded-xl border bg-white p-5 text-slate-900">
 <h2 className="text-xl font-semibold">{fr?"Acquisition · sources et campagnes":"Acquisition · sources and campaigns"}</h2>
 <p className="text-sm">{fr?"Mesure après consentement, à partir du déploiement du suivi d’attribution. Fuseau : Africa/Douala. Les données historiques du pixel ne sont pas réattribuées.":"Consent-based measurement from attribution deployment onward. Time zone: Africa/Douala. Historical pixel data cannot be reattributed."}</p>
 <div className="flex flex-wrap gap-3">
 <label>{fr?"Du":"From"}<input aria-label={fr?"Du":"From"} className="ml-2 rounded border p-2" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
 <label>{fr?"Au":"To"}<input aria-label={fr?"Au":"To"} className="ml-2 rounded border p-2" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
 <label>Source<select className="ml-2 rounded border p-2" value={source} onChange={e=>setSource(e.target.value)}>{["tiktok","facebook","whatsapp","linkedin","youtube","direct_unknown","all"].map(s=><option key={s} value={s}>{s==="direct_unknown"?(fr?"Direct / inconnu":"Direct / unknown"):s==="all"?(fr?"Toutes":"All"):s}</option>)}</select></label>
 <button className="rounded border px-3 py-2" onClick={()=>report.refetch()}>{fr?"Actualiser":"Refresh"}</button></div>
 <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[[fr?"Visites":"Visits",total("visits")],["WhatsApp",total("whatsapp")],[fr?"Débuts d’inscription":"Signup starts",total("starts")],[fr?"Inscriptions réussies":"Completed signups",total("registrations")]].map(([label,n])=><div className="rounded border p-3" key={label}><p className="text-xs">{label}</p><p className="text-2xl font-semibold">{report.isFetching||report.error?"—":n}</p></div>)}</div>
 {report.isFetching&&<p role="status">{fr?"Chargement…":"Loading…"}</p>}
 {report.error&&<p role="alert">{report.error.message}</p>}
 {!report.error&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Source",fr?"Preuve":"Evidence",fr?"Campagne":"Campaign",fr?"Contenu":"Content",fr?"Visites":"Visits",fr?"Pages vues":"Page views","WhatsApp",fr?"Débuts d’inscription":"Signup starts",fr?"Inscriptions réussies":"Completed signups"].map(h=><th className="whitespace-nowrap border-b p-2" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{[r.source,r.evidence,r.campaign||"—",r.content||"—",r.visits,r.pageviews,r.whatsapp,r.starts,r.registrations].map((v,j)=><td className="border-b p-2" key={j}>{v}</td>)}</tr>)}</tbody></table>{!rows.length&&!report.isFetching&&<p className="py-4">{fr?"Aucun événement mesuré pour cette sélection.":"No measured events for this selection."}</p>}</div>}
 <p className="text-xs leading-5">{fr?"Visite = session de navigation (30 min d’inactivité), pas une personne unique. UTM = source déclarée par le lien ; referrer = domaine d’origine reconnu. Sans preuve : direct/inconnu. Une inscription est comptée uniquement après succès serveur. Un clic WhatsApp ne confirme pas un message. Seul app.xpressclean.cm entre dans ce rapport ; les essais Replit sont exclus. Données conservées 90 jours ; la session d’attribution expire après 30 min d’inactivité. Les bloqueurs, le refus du consentement et les changements d’appareil empêchent une attribution exhaustive.":"Visit = browsing session (30 min inactivity), not a unique person. UTM = source declared by the link; referrer = recognized referring domain. Without evidence: direct/unknown. Signups are counted only after server success. A WhatsApp click does not confirm a message. Only app.xpressclean.cm is included; Replit tests are excluded. Data retained for 90 days; attribution expires after 30 min inactivity. Blockers, consent refusal and device changes prevent exhaustive attribution."}</p>
 </section>;
}
