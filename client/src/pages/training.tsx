import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Monitor, Smartphone, Play, RotateCcw, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { TRAINING_LESSONS } from '@shared/training';
import { loadTrainingCatalogue } from '@/lib/training-catalogue';

type Mode='pc'|'mobile';
type Progress={position:number;completed:boolean};
export default function TrainingPage(){
 const {user}=useAuth();
 const {data,isLoading,error,refetch}=useQuery({queryKey:['training-catalogue',user?.id,Boolean(user?.isPlatformAdmin)],queryFn:()=>loadTrainingCatalogue(Boolean(user?.isPlatformAdmin)),retry:false});
 const [lessonId,setLessonId]=useState<string>(TRAINING_LESSONS[0].id);
 const selectedLesson=TRAINING_LESSONS.find(x=>x.id===lessonId)!;
 const [mode,setMode]=useState<Mode>(()=>window.matchMedia('(max-width:767px)').matches?'mobile':'pc');
 const [progress,setProgress]=useState<Progress>({position:0,completed:false});
 const [videoError,setVideoError]=useState(false);
 const [storageUnavailable,setStorageUnavailable]=useState(false);
 const video=useRef<HTMLVideoElement>(null);
 const key=`xpresspro-training:${user?.id}:${lessonId}:${selectedLesson.version}:${mode}`;
 const currentProgress=useRef(progress);
 const lastSave=useRef(0);
 useEffect(()=>{
  let saved:Progress={position:0,completed:false};
  try {const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw&&Number.isFinite(raw.position)&&raw.position>=0)saved={position:Math.min(raw.position,selectedLesson.variants[mode].duration),completed:raw.completed===true};}catch{setStorageUnavailable(true);}
  currentProgress.current=saved;setProgress(saved);setVideoError(false);lastSave.current=0;
 },[key,mode,selectedLesson]);
 function save(completed=false,force=false){
  const v=video.current;if(!v||!Number.isFinite(v.currentTime))return;
  if(!force&&Math.abs(v.currentTime-lastSave.current)<3)return;
  lastSave.current=v.currentTime;
  const next={position:v.currentTime,completed:completed||currentProgress.current.completed};
  currentProgress.current=next;setProgress(next);
  try{localStorage.setItem(key,JSON.stringify(next));}catch{setStorageUnavailable(true);}
 }
 function changeMode(next:Mode){if(next===mode)return;video.current?.pause();save(false,true);setMode(next);}
 async function play(){try{await video.current?.play();}catch{setVideoError(true);}}
 function restart(){if(video.current){video.current.currentTime=0;currentProgress.current={position:0,completed:false};save(false,true);void play();}}
 if(isLoading)return <p role="status">Chargement de votre formation…</p>;
 if(error||!data?.lessons.length)return <div role="alert" className="rounded-2xl border p-6"><p>La formation est momentanément indisponible.</p><Button className="mt-3" onClick={()=>refetch()}>Réessayer</Button></div>;
 const lesson=data.lessons.find(x=>x.id===lessonId) ?? data.lessons[0];
 const number=lesson.number;
 const duration=lesson.variants[mode].duration;
 const pct=progress.completed?100:Math.min(100,Math.round(progress.position/duration*100));
 return <div className="space-y-6" data-testid="training-page">
  <div className="rounded-2xl bg-[#102f57] p-5 text-white md:p-7">
   <p className="mb-2 flex items-center gap-2 text-sm text-violet-200"><GraduationCap className="h-5 w-5"/> APPRENDRE À UTILISER XPRESSPRO</p>
   <h1 className="font-display text-2xl font-bold md:text-3xl">Votre formation, à votre rythme</h1>
   <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Regardez chaque geste, mettez en pause, puis essayez dans votre compte.</p>
  </div>
  {data.adminUnavailable&&<p role="status" className="rounded-xl border bg-card p-4 text-sm">Les leçons ordinaires sont disponibles. La leçon Super Admin reste protégée et nécessite une session Super Admin avec authentification renforcée.</p>}
  <div className="rounded-2xl border bg-card p-4"><label htmlFor="training-lesson" className="mb-2 block text-sm font-semibold">Choisir une leçon · {data.lessons.length} disponibles</label><select id="training-lesson" value={lessonId} className="w-full min-w-0 rounded-lg border bg-background p-3 text-sm" onChange={e=>{video.current?.pause();save(false,true);setLessonId(e.target.value);}}>{data.lessons.map(item=><option key={item.id} value={item.id}>{item.number}. {item.title}</option>)}</select><p className="mt-2 text-xs text-muted-foreground">Les démonstrations utilisent des données fictives. Les fonctionnalités accessibles dans votre compte dépendent de votre formule et de vos droits.</p></div>
  <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
   <section className="min-w-0 rounded-2xl border bg-card p-4 md:p-6" aria-labelledby="lesson-title">
    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Leçon {String(number).padStart(2,'0')} · Français · Environ {Math.max(1,Math.round(duration/60))} min</p>
    <h2 id="lesson-title" className="mt-2 text-xl font-bold">{lesson.title}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{lesson.description}</p>
    <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Format de la démonstration">
     <Button variant={mode==='pc'?'default':'outline'} aria-pressed={mode==='pc'} onClick={()=>changeMode('pc')}><Monitor className="mr-2 h-4 w-4"/>Sur ordinateur</Button>
     <Button variant={mode==='mobile'?'default':'outline'} aria-pressed={mode==='mobile'} onClick={()=>changeMode('mobile')}><Smartphone className="mr-2 h-4 w-4"/>Sur téléphone</Button>
    </div>
    {!lesson.variants[mode].hasVoice&&<p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Version sans voix : suivez les gestes et les indications à l’écran. La narration sera ajoutée ultérieurement.</p>}
    <div className="rounded-xl bg-[#091b31] p-1">
     <video key={key} ref={video} src={lesson.variants[mode].url} controls playsInline preload="metadata"
      aria-label={`${lesson.title} — ${mode==='pc'?'ordinateur':'téléphone'}`}
      className={mode==='pc'?'mx-auto aspect-video w-full rounded-lg':'mx-auto aspect-[9/16] w-full max-w-[340px] rounded-lg'}
      onLoadedMetadata={()=>{if(video.current&&!currentProgress.current.completed)video.current.currentTime=Math.min(currentProgress.current.position,Math.max(0,video.current.duration-.5));}}
      onTimeUpdate={()=>save()} onPause={()=>save(false,true)} onEnded={()=>save(true,true)} onError={()=>setVideoError(true)} />
    </div>
    {videoError&&<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La vidéo n’a pas pu être chargée. Vérifiez votre connexion puis <button className="underline" onClick={()=>{setVideoError(false);video.current?.load();}}>réessayez</button>.</p>}
    <div className="mt-4 flex flex-wrap gap-2">
     <Button onClick={play}><Play className="mr-2 h-4 w-4"/>{progress.position>1&&!progress.completed?'Reprendre la leçon':'Lire la leçon'}</Button>
     <Button variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4"/>Recommencer</Button>
    </div>
    <div className="mt-4 flex items-center justify-between text-sm"><span>{progress.completed?'Leçon terminée':progress.position>1?'En cours':'À commencer'}</span><span>{pct} %</span></div>
    <progress className="mt-1 h-2 w-full accent-[#695cff]" value={pct} max={100} aria-label="Progression de la leçon"/>
    <p className="mt-2 text-xs text-muted-foreground">{storageUnavailable?'Votre navigateur ne permet pas de mémoriser la progression.':'Votre progression est mémorisée sur ce navigateur, séparément pour chaque format.'}</p>
   </section>
   <aside className="space-y-4">
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-bold">Dans cette leçon</h2><ul className="mt-3 space-y-3 text-sm">{lesson.objectives.map(x=><li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary"/>{x}</li>)}</ul></section>
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-bold">À vous de jouer</h2><p className="my-3 text-sm text-muted-foreground">{lesson.id==='services-tarifs'?'Retrouvez vos prestations dans Services et vérifiez leurs tarifs avant de préparer une commande.':lesson.id==='parametres-recus'?'Vérifiez les informations de votre pressing dans les paramètres accessibles avec votre formule. La personnalisation présentée dans cette leçon ne débloque aucun droit supplémentaire.':'Retrouvez les principales rubriques dans votre menu. Vous pouvez revenir ici à tout moment depuis Formation ou Aide.'}</p><Button variant="outline" asChild className="w-full"><Link href="/dashboard">Ouvrir mon tableau de bord<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></section>
   </aside>
  </div>
 </div>;
}
