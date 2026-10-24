import React from 'react';
import {createRoot}from'react-dom/client';
import {QueryClientProvider}from'@tanstack/react-query';
import {queryClient}from'../../client/src/lib/queryClient';
import CollectionPilot from '../../client/src/pages/collection-pilot';
import i18n from '../../client/src/lib/i18n';
import '../../client/src/index.css';
i18n.changeLanguage('fr');
function Preview(){return <QueryClientProvider client={queryClient}><div className="mx-auto max-w-3xl space-y-4 p-4"><aside className="rounded-xl bg-slate-100 p-4 space-y-3"><p>Démonstration locale · Données fictives · Aucun paiement réel</p><button className="mr-4 underline" onClick={()=>i18n.changeLanguage(i18n.language==='fr'?'en':'fr')}>FR / EN</button><button className="underline" onClick={async()=>{await fetch('/__qa/complete',{method:'POST'});queryClient.invalidateQueries();}}>Simuler le résultat confirmé</button></aside><CollectionPilot/></div></QueryClientProvider>};createRoot(document.getElementById('root')!).render(<Preview/>);
