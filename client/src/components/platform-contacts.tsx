import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DecisionAccount } from '@shared/platform-admin-decision';
import { caseStatuses, contactChannels, contactOutcomes, type CaseStatus, type ContactCommand, type ContactDetail, type ContactDirectory, type ContactHistoryEvent, type MessageChannel, type WhatsAppCatalog, type WhatsAppTemplate, type DeliveryStatus } from '@shared/platform-contact';

import { renderWhatsAppTemplate, templateParameterCount } from '@shared/whatsapp-template';

type NewCommand = ContactCommand extends infer C ? C extends ContactCommand ? Omit<C, 'requestId' | 'expectedVersion'> : never : never;
type Copy = (fr: string, en: string) => string;
const labels: Record<string, [string, string]> = {
  open: ['À contacter', 'To contact'], in_progress: ['Accompagnement en cours', 'Support in progress'], paused: ['En pause', 'Paused'], closed: ['Terminé', 'Closed'], do_not_contact: ['Ne plus contacter', 'Do not contact'],
  whatsapp: ['WhatsApp', 'WhatsApp'], email: ['Email', 'Email'], call: ['Appel', 'Call'], sms: ['SMS', 'SMS'],
  contacted: ['Échange effectué', 'Contact made'], no_answer: ['Sans réponse', 'No answer'], needs_help: ['Besoin d’aide', 'Needs help'], demo_planned: ['Démonstration prévue', 'Demo planned'], interested: ['Intéressé par un abonnement', 'Interested in a subscription'], not_interested: ['Pas intéressé', 'Not interested'],
  new: ['Nouveau', 'New'], support: ['À accompagner', 'Needs support'], subscription: ['À relancer · abonnement', 'Follow up · subscription'], renewal: ['À relancer · renouvellement', 'Follow up · renewal'], payment_review: ['Paiement à vérifier', 'Review payment'], active: ['Accès en cours', 'Current access'], watch: ['Démarrage à suivre', 'Monitor onboarding'],
  delivery: ['Suivi de l’envoi WhatsApp', 'WhatsApp sending update'],
  contact: ['Contact enregistré', 'Contact recorded'], plan: ['Suivi mis à jour', 'Follow-up updated'], save_message: ['Brouillon enregistré', 'Draft saved'], approve_message: ['Message validé', 'Message approved'], cancel_message: ['Message annulé', 'Message cancelled'],
};
const label = (value: string, t: Copy) => labels[value] ? t(...labels[value]) : value;
function useCopy() {
  const { i18n } = useTranslation(); const fr = i18n.language.startsWith('fr');
  const t: Copy = (a, b) => fr ? a : b;
  const date = (value: string | null, time = false) => value ? new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}), timeZone: 'Africa/Douala' }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value)) : '—';
  return { t, date, language: fr ? 'fr' as const : 'en' as const };
}
export function contactError(code: string, t: Copy) {
  const errors: Record<string, [string, string]> = {
    CONTACT_WHATSAPP_NOT_CONFIGURED: ['WhatsApp reste à connecter ou à activer.', 'WhatsApp needs to be connected or enabled.'],
    CONTACT_TEMPLATE_REQUIRED: ['Choisis un modèle WhatsApp approuvé, puis enregistre et valide le message.', 'Select an approved WhatsApp template, then save and approve the message.'],
    CONTACT_TEMPLATE_CHANGED: ['Le modèle WhatsApp a changé ou n’est plus approuvé. Recharge les modèles et revois le message.', 'The WhatsApp template changed or is no longer approved. Reload templates and review the message.'],
    CONTACT_TEMPLATE_INVALID: ['Vérifie les champs personnalisés du modèle.', 'Check the template’s personalised fields.'],
    CONTACT_SENDER_REQUIRED: ['Choisis un numéro expéditeur, puis enregistre et valide le message.', 'Choose a sender number, then save and approve the message.'],
    CONTACT_SENDER_UNAVAILABLE: ['Ce numéro expéditeur n’est plus disponible. Actualise la connexion et choisis un numéro connecté.', 'This sender number is unavailable. Refresh the connection and choose a connected number.'],
    CONTACT_SENDER_CHANGED: ['Le numéro expéditeur a changé chez WhatsApp. Enregistre et valide à nouveau le message.', 'The sender number changed in WhatsApp. Save and approve the message again.'],
    CONTACT_PROVIDER_UNAVAILABLE: ['La connexion à WhatsApp est indisponible. Réessaie plus tard.', 'The WhatsApp connection is unavailable. Try again later.'],
    CONTACT_RECIPIENT_INVALID: ['Le numéro doit contenir un indicatif international, par exemple +237…', 'The number must contain an international country code, for example +237…'],
    CONTACT_APPROVAL_REQUIRED: ['Enregistre puis valide ce message avant de l’envoyer.', 'Save and approve this message before sending.'],
    CONTACT_DELIVERY_UNRESOLVED: ['Un précédent envoi a un résultat incertain. Vérifie-le auprès du fournisseur avant une nouvelle relance.', 'A previous send has an unknown result. Check it with the provider before another follow-up.'],
    CONTACT_STATE_CHANGED: ['Le suivi a changé. Actualise la fiche avant de recommencer.', 'Follow-up changed. Refresh the record before trying again.'],
    CONTACT_CONTEXT_CHANGED: ['La situation du pressing a changé. Actualise et revois le message.', 'The pressing situation changed. Refresh and review the message.'],
    CONTACT_APPROVAL_BLOCKED: ['Ce suivi est en pause, terminé ou marqué « Ne plus contacter ».', 'This follow-up is paused, closed or marked “Do not contact”.'],
    CONTACT_INVALID_SCHEDULE: ['Renseigne une action et une date à partir d’aujourd’hui, ou laisse les deux vides. Un suivi terminé ne peut pas avoir d’action prévue.', 'Enter both an action and a date from today, or leave both blank. A closed follow-up cannot have a scheduled action.'],
    CONTACT_INVALID_DATE: ['La date du contact doit être comprise entre l’inscription et maintenant.', 'Contact time must be between registration and now.'],
    CONTACT_RECIPIENT_MISSING: ['Les coordonnées nécessaires à ce canal sont manquantes.', 'Contact details for this channel are missing.'],
    CONTACT_ORGANISATION_UNAVAILABLE: ['Ce pressing est indisponible ou exclu du suivi.', 'This pressing is unavailable or excluded from follow-up.'],
    CONTACT_AUTH_REQUIRED: ['Reconnecte-toi au superadmin pour poursuivre.', 'Sign in to Super Admin again to continue.'],
    CONTACT_INVALID_INPUT: ['Vérifie les champs du formulaire.', 'Check the form fields.'],
  };
  return errors[code] ? t(...errors[code]) : t('Impossible de terminer cette opération. Actualise ou réessaie.', 'Unable to complete this operation. Refresh or try again.');
}
async function response<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(r.status === 401 ? 'CONTACT_AUTH_REQUIRED' : body.message || 'CONTACT_UNAVAILABLE');
  return body;
}
const inputClass = 'mt-1 block w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-950';
const sectionClass = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4';
function Pager({ offset, total, limit, change, pending, t }: { offset: number; total: number; limit: number; change: (offset: number) => void; pending?: boolean; t: Copy }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total ? `${offset + 1}–${Math.min(offset + limit, total)} / ${total}` : '0'}</span><div className="flex gap-2">
    <Button variant="outline" disabled={pending || offset === 0} onClick={() => change(Math.max(0, offset - limit))}>{t('Précédent', 'Previous')}</Button>
    <Button variant="outline" disabled={pending || offset + limit >= total} onClick={() => change(offset + limit)}>{t('Suivant', 'Next')}</Button>
  </div></div>;
}
export function PlatformContactDirectory({ open }: { open: (account: DecisionAccount) => void }) {
  const { t, date } = useCopy();
  const [days, setDays] = useState('30'), [search, setSearch] = useState(''), [term, setTerm] = useState(''), [filter, setFilter] = useState('all'), [offset, setOffset] = useState(0);
  const query = useQuery<ContactDirectory>({ queryKey: ['/api/platform-admin/contacts', days, term, filter, offset], retry: 1,
    queryFn: () => fetch('/api/platform-admin/contacts?' + new URLSearchParams({ days, search: term, filter, offset: String(offset) }), { credentials: 'include', cache: 'no-store' }).then(response<ContactDirectory>) });
  const data = query.data;
  return <section className="space-y-5" aria-label={t('Accompagnement des pressings', 'Pressing follow-up')}>
    <div className={sectionClass}><h2 className="text-xl font-bold">{t('Accompagnement et relances', 'Support and follow-ups')}</h2>
      <p className="text-sm text-slate-600">{t('Prépare les échanges, conserve leur résultat et organise la prochaine action. Les pressings déjà suivis restent visibles quelle que soit leur date d’inscription.', 'Prepare conversations, record outcomes and plan the next action. Tracked pressings remain visible regardless of their registration date.')}</p>
      <div className="flex flex-wrap gap-2">{(['all', 'due', 'drafts', 'approved'] as const).map(v => <Button key={v} variant={filter === v ? 'default' : 'outline'} aria-pressed={filter === v} onClick={() => { setFilter(v); setOffset(0); }}>
        {({ all: t('Tous', 'All'), due: t('Actions à faire', 'Actions due'), drafts: t('Messages à valider', 'Messages to review'), approved: t('Prêts à envoyer', 'Ready to send') })[v]}{data ? ` · ${data.counts[v]}` : ''}
      </Button>)}</div>
      <form className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={e => { e.preventDefault(); setTerm(search.trim()); setOffset(0); }}>
        <label className="text-xs text-slate-600">{t('Rechercher un pressing ou son responsable', 'Search pressing or owner')}<input className={inputClass} type="search" maxLength={120} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label className="text-xs text-slate-600">{t('Nouveaux inscrits sur', 'New registrations over')}<select className={inputClass} value={days} onChange={e => { setDays(e.target.value); setOffset(0); }}>{[7, 30, 90].map(n => <option key={n} value={n}>{n} {t('jours', 'days')}</option>)}</select></label>
        <Button type="submit">{t('Rechercher', 'Search')}</Button>
      </form>
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="text-xs text-slate-600">{t('Afficher', 'Show')}<select className={inputClass} value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}>
        {Object.entries({ all: t('Tous', 'All'), due: t('Actions à faire', 'Actions due'), drafts: t('Messages à valider', 'Messages to review'), approved: t('Messages validés', 'Approved messages'), support: t('À accompagner', 'Needs support'), subscription: t('Abonnement ou renouvellement', 'Subscription or renewal'), tracked: t('Déjà suivis', 'Already tracked'), do_not_contact: t('Ne plus contacter', 'Do not contact') }).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
      </select></label><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>{t('Actualiser', 'Refresh')}</Button></div>
    </div>
    {query.isLoading && <p role="status">{t('Chargement du suivi…', 'Loading follow-ups…')}</p>}
    {query.error && <p role="alert" className="text-red-700">{contactError(query.error.message, t)}</p>}
    {data?.items.map(e => <article key={e.account.id} className={`${sectionClass} grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]`}>
      <div className="min-w-0"><h3 className="break-words font-semibold">{e.account.name}</h3><p className="break-words text-sm text-slate-600">{e.account.owner.name}</p><p className="mt-2 text-xs text-slate-500">{e.account.activity.orders} {t('commandes', 'orders')} · {label(e.account.followUp.status, t)}</p><p className="mt-2 text-sm font-medium">{label(e.tracking.status, t)}</p></div>
      <div className="min-w-0 text-sm"><p className="text-slate-500">{t('Dernier contact', 'Last contact')} : {date(e.tracking.lastContactAt)}</p><p className={`mt-2 break-words ${e.due ? 'font-semibold text-amber-800' : ''}`}>{e.tracking.nextAction ? `${date(e.tracking.nextActionDate)} · ${e.tracking.nextAction}` : t('Aucune prochaine action planifiée', 'No next action scheduled')}</p>
        {e.tracking.message && <p className="mt-2 text-xs text-cyan-800">{e.messageStale ? t('Message à revoir · situation modifiée', 'Review message · situation changed') : e.tracking.message.status === 'approved' ? e.tracking.message.deliveryId ? t('Envoi enregistré · voir l’historique', 'Send recorded · view history') : t('Message validé', 'Approved message') : t('Brouillon à valider', 'Draft to review')}</p>}</div>
      <Button variant="outline" className="self-start" onClick={() => open(e.account)}>{t('Ouvrir le suivi', 'Open follow-up')}</Button>
    </article>)}
    {data && !data.items.length && <p className={sectionClass}>{t('Aucun pressing ne correspond à ces filtres.', 'No pressing matches these filters.')}</p>}
    {data && <Pager {...data} change={setOffset} pending={query.isFetching} t={t} />}
  </section>;
}

export function PlatformContactPanel({ account, close }: { account: DecisionAccount; close: () => void }) {
  const { t } = useCopy();
  return <Sheet open onOpenChange={v => { if (!v) close(); }}><SheetContent side="right" aria-describedby={undefined} className="h-full w-full overflow-y-auto bg-slate-50 p-0 sm:max-w-3xl">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white p-5 pr-12"><div><p className="text-xs text-cyan-700">{t('Accompagnement', 'Follow-up')}</p><SheetTitle className="break-words">{account.name}</SheetTitle></div><Button variant="ghost" onClick={close}>{t('Fermer', 'Close')}</Button></div>
    <div className="p-4 sm:p-6"><PlatformContactWorkspace key={account.id} organisationId={account.id} /></div>
  </SheetContent></Sheet>;
}
export function PlatformContactWorkspace({ organisationId }: { organisationId: number }) {
  const { t } = useCopy(); const client = useQueryClient(); const [offset, setOffset] = useState(0), [feedback, setFeedback] = useState(''), [tab, setTab] = useState('contact');
  const request = useRef<{ signature: string; command: ContactCommand }>();
  const query = useQuery<ContactDetail>({ queryKey: ['/api/platform-admin/contacts/detail', organisationId, offset], refetchOnWindowFocus: false, retry: 1,
    queryFn: () => fetch(`/api/platform-admin/contacts/${organisationId}?offset=${offset}`, { credentials: 'include', cache: 'no-store' }).then(response<ContactDetail>) });
  const mutation = useMutation({ mutationFn: (input: NewCommand) => {
    const signature = JSON.stringify([query.data!.tracking.version, input]);
    if (request.current?.signature !== signature) request.current = { signature, command: { ...input, requestId: crypto.randomUUID(), expectedVersion: query.data!.tracking.version } as ContactCommand };
    return fetch(`/api/platform-admin/contacts/${organisationId}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.current.command) }).then(response<{ version: number }>);
  }, onSuccess: async () => { request.current = undefined; setFeedback(t('Suivi enregistré.', 'Follow-up saved.')); setOffset(0); await Promise.all([client.invalidateQueries({ queryKey: ['/api/platform-admin/contacts'] }), client.invalidateQueries({ queryKey: ['/api/platform-admin/contacts/detail', organisationId] })]); } });
  const catalog = useQuery<WhatsAppCatalog>({ queryKey: ['/api/platform-admin/contacts/whatsapp'], retry: false, refetchOnWindowFocus: false,
    queryFn: () => fetch('/api/platform-admin/contacts/whatsapp', { credentials: 'include', cache: 'no-store' }).then(response<WhatsAppCatalog>) });
  const sendRequest = useRef<{ approvalId: string; requestId: string; expectedVersion: number; consentConfirmed: true }>();
  const sending = useMutation({ mutationFn: () => {
    const approvalId = query.data!.tracking.message!.approvalId!;
    if (sendRequest.current?.approvalId !== approvalId) sendRequest.current = { approvalId, requestId: crypto.randomUUID(), expectedVersion: query.data!.tracking.version, consentConfirmed: true };
    return fetch(`/api/platform-admin/contacts/${organisationId}/send`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sendRequest.current) }).then(response<{ status: DeliveryStatus }>);
  }, onSuccess: result => setFeedback(deliveryLabel(result.status, t)), onSettled: async () => {
    setOffset(0); await Promise.all([client.invalidateQueries({ queryKey: ['/api/platform-admin/contacts'] }), client.invalidateQueries({ queryKey: ['/api/platform-admin/contacts/detail', organisationId] })]);
  } });
  const save = (input: NewCommand) => { setFeedback(''); mutation.mutate(input); };
  return <section className="space-y-4" aria-label={t('Historique, prochaine action et message', 'History, next action and message')}>
    <div className="flex flex-wrap justify-between gap-2"><p className="max-w-md text-sm text-slate-600">{t('Valide le message, confirme son envoi puis retrouve son statut dans l’historique. Enregistre séparément le résultat de vos échanges.', 'Approve the message, confirm sending, then follow its status in history. Record conversation outcomes separately.')}</p><Button variant="outline" disabled={query.isFetching || mutation.isPending || sending.isPending} onClick={() => { mutation.reset(); sending.reset(); setFeedback(''); query.refetch(); }}>{t('Actualiser', 'Refresh')}</Button></div>
    {query.isLoading && <p role="status">{t('Chargement…', 'Loading…')}</p>}
    {query.error && <p role="alert" className="text-red-700">{contactError(query.error.message, t)}</p>}
    {mutation.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{contactError(mutation.error.message, t)}</p>}
    {sending.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{contactError(sending.error.message, t)}</p>}
    {feedback && <p role="status" className="text-sm text-emerald-800">{feedback}</p>}
    {query.data && <ContactEditor key={`${organisationId}-${query.data.tracking.version}`} detail={query.data} save={save} pending={mutation.isPending || sending.isPending || query.isFetching} catalog={catalog.data} catalogError={!!catalog.error} reloadCatalog={() => catalog.refetch()} send={() => { setFeedback(''); sending.mutate(); }} historyPage={setOffset} tab={tab} onTabChange={setTab} />}
  </section>;
}

export function ContactEditor({ detail: d, save, pending, historyPage, tab, onTabChange, catalog, catalogError, reloadCatalog, send }: { detail: ContactDetail; save: (command: NewCommand) => void; pending: boolean; historyPage: (offset: number) => void; tab?: string; onTabChange?: (tab: string) => void; catalog?: WhatsAppCatalog; catalogError?: boolean; reloadCatalog?: () => void; send?: () => void }) {
  const { t, date, language: uiLanguage } = useCopy();
  const [status, setStatus] = useState<CaseStatus>(d.tracking.status), [nextAction, setNextAction] = useState(d.tracking.nextAction), [nextDate, setNextDate] = useState(d.tracking.nextActionDate ?? ''), [note, setNote] = useState('');
  const [channel, setChannel] = useState<typeof contactChannels[number]>('whatsapp'), [outcome, setOutcome] = useState<typeof contactOutcomes[number]>('contacted');
  const localNow = new Date(Date.now() + 3600000).toISOString().slice(0, 19);
  const [contactAt, setContactAt] = useState(localNow), [recordContact, setRecordContact] = useState(true);
  const [language, setLanguage] = useState<'fr' | 'en'>(d.tracking.message?.language ?? uiLanguage), [messageChannel, setMessageChannel] = useState<MessageChannel>(d.tracking.message?.channel ?? 'whatsapp');
  const [text, setText] = useState(d.tracking.message?.text ?? d.suggestion[uiLanguage]), [context, setContext] = useState(d.tracking.message?.contextFingerprint ?? d.contextFingerprint), [copyStatus, setCopyStatus] = useState('');
  const [template, setTemplate] = useState<WhatsAppTemplate | null>(d.tracking.message?.whatsappTemplate ?? null), [consent, setConsent] = useState(false);
  const [senderId, setSenderId] = useState(d.tracking.message?.whatsappSender?.id ?? '');
  const message = d.tracking.message;
  const selectedSender = catalog?.senders.find(s => s.id === senderId);
  const approvedSenderAvailable = !!message?.whatsappSender && catalog?.senders.some(s => s.id === message.whatsappSender!.id && s.accountId === message.whatsappSender!.accountId && s.phoneNumber === message.whatsappSender!.phoneNumber && s.name === message.whatsappSender!.name);
  const edited = !message || text.trim() !== message.text || language !== message.language || messageChannel !== message.channel || context !== message.contextFingerprint || JSON.stringify(template) !== JSON.stringify(message.whatsappTemplate ?? null) || !!template && (senderId !== message.whatsappSender?.id || !!selectedSender && !approvedSenderAvailable);
  const noContact = ['closed', 'do_not_contact'].includes(status);
  function submit(e: FormEvent) {
    e.preventDefault();
    const plan = { status, nextAction, nextActionDate: nextDate || null, note };
    if (recordContact) save({ ...plan, action: 'contact', channel, outcome, contactAt: new Date(contactAt + '+01:00').toISOString() });
    else save({ ...plan, action: 'plan' });
  }
  async function copyApproved() {
    setCopyStatus('');
    try {
      const latest = await fetch(`/api/platform-admin/contacts/${d.account.id}`, { credentials: 'include', cache: 'no-store' }).then(response<ContactDetail>);
      if (latest.messageStale || latest.approvalBlocked || latest.tracking.message?.status !== 'approved' || latest.tracking.version !== d.tracking.version) throw Error('CONTACT_CONTEXT_CHANGED');
      await navigator.clipboard.writeText(latest.tracking.message.text);
      setCopyStatus(t('Message copié. Le contact reste à effectuer puis à enregistrer.', 'Message copied. Contact still needs to be made and recorded.'));
    } catch (error) { setCopyStatus(contactError((error as Error).message, t)); }
  }
  return <div className="space-y-4">
    <div className="grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2"><div><p className="font-semibold">{d.account.owner.name || t('Responsable non renseigné', 'Owner unavailable')}</p><p className="break-all text-slate-600">{d.account.owner.phone || '—'}</p><p className="break-all text-slate-600">{d.account.owner.email || '—'}</p></div><div><p>{d.account.activity.orders} {t('commandes au total', 'total orders')} · {d.account.activity.orders7} {t('sur 7 jours', 'over 7 days')}</p><p>{label(d.account.followUp.status, t)}</p><p className="mt-2 font-semibold">{label(d.tracking.status, t)}</p><p>{t('Dernier contact', 'Last contact')} : {date(d.tracking.lastContactAt, true)}</p></div>
      {d.tracking.nextAction && <p className={`break-words sm:col-span-2 ${d.due ? 'font-semibold text-amber-800' : ''}`}>{t('Prochaine action', 'Next action')} : {date(d.tracking.nextActionDate)} · {d.tracking.nextAction}</p>}
    </div>
    <Tabs defaultValue="contact" value={tab} onValueChange={onTabChange}><TabsList className="h-auto w-full flex-wrap justify-start"><TabsTrigger value="contact">{t('Contact et action', 'Contact and action')}</TabsTrigger><TabsTrigger value="message">{t('Message à valider', 'Message to review')}</TabsTrigger><TabsTrigger value="history">{t('Historique', 'History')} · {d.history.total}</TabsTrigger></TabsList>
      <TabsContent value="contact"><form className={sectionClass} onSubmit={submit}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recordContact} onChange={e => setRecordContact(e.target.checked)} />{t('Enregistrer un contact effectué', 'Record an actual contact')}</label>
        {recordContact && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t('Canal du contact', 'Contact channel')}<select className={inputClass} value={channel} onChange={e => setChannel(e.target.value as typeof channel)}>{contactChannels.map(v => <option key={v} value={v}>{label(v, t)}</option>)}</select></label>
          <label className="text-sm">{t('Résultat', 'Outcome')}<select className={inputClass} value={outcome} onChange={e => setOutcome(e.target.value as typeof outcome)}>{contactOutcomes.map(v => <option key={v} value={v}>{label(v, t)}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">{t('Date du contact · heure de Douala', 'Contact time · Douala time')}<input required className={inputClass} type="datetime-local" step="1" max={localNow} value={contactAt} onChange={e => setContactAt(e.target.value)} /></label></div>}
        <label className="block text-sm">{t('État du suivi', 'Follow-up status')}<select className={inputClass} value={status} onChange={e => { const v = e.target.value as CaseStatus; setStatus(v); if (['closed', 'do_not_contact'].includes(v)) { setNextAction(''); setNextDate(''); } }}>{caseStatuses.map(v => <option key={v} value={v}>{label(v, t)}</option>)}</select></label>
        <label className="block text-sm">{t('Prochaine action', 'Next action')}<input className={inputClass} maxLength={300} disabled={noContact} value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder={t('Ex. Appeler pour guider la première commande', 'E.g. Call to guide the first order')} /></label>
        <label className="block text-sm">{t('Date prévue · Douala', 'Planned date · Douala')}<input className={inputClass} type="date" min={localNow.slice(0, 10)} disabled={noContact} required={!!nextAction.trim()} value={nextDate} onChange={e => setNextDate(e.target.value)} /></label>
        <label className="block text-sm">{t('Note sur l’échange ou la prochaine action', 'Note about the contact or next action')}<textarea required minLength={3} maxLength={2000} className={inputClass} rows={3} value={note} onChange={e => setNote(e.target.value)} /></label>
        <Button type="submit" disabled={pending || note.trim().length < 3 || !!nextAction.trim() !== !!nextDate}>{pending ? t('Enregistrement…', 'Saving…') : recordContact ? t('Enregistrer le contact et le suivi', 'Save contact and follow-up') : t('Enregistrer le suivi', 'Save follow-up')}</Button>
      </form></TabsContent>
      <TabsContent value="message"><div className={sectionClass}>
        <h3 className="font-semibold">{t('Message personnalisé', 'Personalised message')}</h3><p className="text-sm text-slate-600">{t('Adapte le texte à vos échanges avant de le valider. Valider ne signifie pas envoyer.', 'Adapt the text to your conversations before approving it. Approval does not send it.')}</p>
        {d.approvalBlocked && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{contactError('CONTACT_APPROVAL_BLOCKED', t)}</p>}
        {d.messageStale && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('La situation a changé depuis ce brouillon. Revois le contenu avant une nouvelle validation.', 'The situation changed since this draft. Review it before a new approval.')}</p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t('Canal du message', 'Message channel')}<select className={inputClass} value={messageChannel} onChange={e => { setMessageChannel(e.target.value as MessageChannel); setTemplate(null); }}>{['whatsapp', 'email', 'sms'].map(v => <option key={v} value={v}>{label(v, t)}</option>)}</select></label>
          <label className="text-sm">{t('Langue du message', 'Message language')}<select className={inputClass} value={language} onChange={e => { setLanguage(e.target.value as 'fr' | 'en'); setTemplate(null); }}><option value="fr">Français</option><option value="en">English</option></select></label></div>
        {messageChannel === 'whatsapp' && <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">
          <p className="font-semibold">{catalog?.configured ? catalog.enabled ? t('WhatsApp connecté', 'WhatsApp connected') : t('WhatsApp connecté · envoi désactivé', 'WhatsApp connected · sending disabled') : catalogError ? t('Connexion WhatsApp indisponible', 'WhatsApp connection unavailable') : catalog ? t('WhatsApp · à connecter', 'WhatsApp · connect your account') : t('Vérification de WhatsApp…', 'Checking WhatsApp…')}</p>
          <p>{t('Pour une relance depuis le superadmin, choisis un modèle approuvé par WhatsApp. Personnalise ses champs puis vérifie le texte complet.', 'To send a follow-up from Super Admin, select a WhatsApp-approved template. Personalise its fields, then review the complete text.')}</p>
          {!catalog?.configured && <p>{t('Le numéro professionnel doit être associé à WhatsApp Business Platform. Les brouillons et la copie manuelle restent disponibles.', 'Connect the business number to WhatsApp Business Platform. Drafts and manual copying remain available.')}</p>}
          {catalog?.configured && <label className="block">{t('Numéro expéditeur', 'Sender number')}<select className={inputClass} value={senderId} onChange={e => { setSenderId(e.target.value); setConsent(false); }}>
            <option value="">{t('Choisir un numéro connecté', 'Choose a connected number')}</option>
            {senderId && !selectedSender && <option value={senderId} disabled>{message?.whatsappSender?.phoneNumber || senderId} · {t('indisponible', 'unavailable')}</option>}
            {catalog.senders.map(s => <option key={s.id} value={s.id}>{s.name} · {s.phoneNumber}</option>)}
          </select></label>}
          {catalog?.configured && !catalog.senders.length && <p>{t('Aucun numéro autorisé n’est connecté à WhatsApp.', 'No authorised number is connected to WhatsApp.')}</p>}
          {catalog?.configured && <label className="block">{t('Modèle WhatsApp', 'WhatsApp template')}<select className={inputClass} value={template?.id ?? ''} onChange={e => {
            const selected = catalog.templates.find(v => v.id === e.target.value);
            if (!selected) { setTemplate(null); return; }
            const parameters = Array.from({ length: templateParameterCount(selected.body) }, (_, i) => i === 0 ? d.account.owner.name?.split(' ')[0] || '' : i === 1 ? d.account.name : '');
            const next = { ...selected, parameters }; setTemplate(next); setText(renderWhatsAppTemplate(next)); setContext(d.contextFingerprint);
          }}><option value="">{t('Texte libre · copie manuelle', 'Free text · manual copying')}</option>{catalog.templates.filter(v => v.language.startsWith(language)).map(v => <option key={v.id} value={v.id}>{v.name} · {v.language}</option>)}</select></label>}
          {catalog?.configured && !catalog.templates.some(v => v.language.startsWith(language)) && <p>{t('Aucun modèle texte approuvé disponible dans cette langue.', 'No approved text template available in this language.')}</p>}
          {template?.parameters.map((parameter, index) => <label className="block" key={index}>{t('Champ personnalisé', 'Personalised field')} {index + 1}<input className={inputClass} maxLength={300} value={parameter} onChange={e => {
            const next = { ...template, parameters: template.parameters.map((v, i) => i === index ? e.target.value : v) }; setTemplate(next); setText(renderWhatsAppTemplate(next));
          }} /></label>)}
          <Button variant="outline" disabled={pending} onClick={reloadCatalog}>{t('Actualiser la connexion et les modèles', 'Refresh connection and templates')}</Button>
        </div>}
        <Button variant="outline" disabled={pending} onClick={() => { setTemplate(null); setText(d.suggestion[language]); setContext(d.contextFingerprint); }}>{t('Utiliser la proposition actuelle', 'Use the current suggestion')}</Button>
        <label className="block text-sm">{t('Texte à valider', 'Text to approve')}<textarea readOnly={!!template} className={inputClass} rows={10} minLength={10} maxLength={3000} value={text} onChange={e => setText(e.target.value)} /></label>
        {context !== d.contextFingerprint && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={false} onChange={() => setContext(d.contextFingerprint)} />{t('J’ai revu ce texte selon la situation actuelle.', 'I reviewed this text against the current situation.')}</label>}
        <div className="flex flex-wrap gap-2"><Button disabled={pending || text.trim().length < 10 || text.trim().length > 3000 || context !== d.contextFingerprint || !edited || !!template && (!selectedSender || template.parameters.some(v => !v.trim()))} onClick={() => save({ action: 'save_message', text, channel: messageChannel, language, contextFingerprint: context, ...(template ? { whatsappTemplate: template, whatsappSenderId: senderId } : {}) })}>{t('Enregistrer le brouillon', 'Save draft')}</Button>
          {message?.status === 'draft' && <Button variant="outline" disabled={pending || edited || d.messageStale || d.approvalBlocked} onClick={() => save({ action: 'approve_message' })}>{t('Valider le message', 'Approve message')}</Button>}
          {message?.status === 'approved' && <Button variant="outline" disabled={pending || edited || d.messageStale || d.approvalBlocked} onClick={copyApproved}>{t('Copier le message validé', 'Copy approved message')}</Button>}
          {message && <Button variant="ghost" disabled={pending} onClick={() => save({ action: 'cancel_message' })}>{t('Annuler ce message', 'Cancel this message')}</Button>}</div>
        {message?.status === 'approved' && <p className="text-sm text-cyan-800">{t('Validé par', 'Approved by')} {message.approvedBy} · {date(message.approvedAt, true)} · {edited ? t('Modifications à enregistrer et valider', 'Save and approve the changes') : d.messageStale || d.approvalBlocked ? t('Validation antérieure · à revoir', 'Previous approval · review required') : message.deliveryId ? t('Envoi enregistré', 'Send recorded') : t('Prêt pour la prochaine étape', 'Ready for the next step')}</p>}
        {message?.status === 'approved' && message.channel === 'whatsapp' && !message.deliveryId && <div className="space-y-3 rounded-lg border border-cyan-300 p-4">
          <h4 className="font-semibold">{t('Confirmer l’envoi WhatsApp', 'Confirm WhatsApp sending')}</h4>
          <p className="break-words text-sm">{t('Expéditeur validé', 'Approved sender')} : {message.whatsappSender ? `${message.whatsappSender.name} · ${message.whatsappSender.phoneNumber}` : '—'}</p>
          <p className="break-words text-sm">{t('Destinataire', 'Recipient')} : {d.account.owner.name} · {d.account.owner.phone || '—'}</p>
          {!message.whatsappTemplate && <p className="text-sm text-amber-900">{contactError('CONTACT_TEMPLATE_REQUIRED', t)}</p>}
          {message.whatsappTemplate && !approvedSenderAvailable && <p className="text-sm text-amber-900">{contactError(message.whatsappSender ? 'CONTACT_SENDER_UNAVAILABLE' : 'CONTACT_SENDER_REQUIRED', t)}</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t('Ce responsable a accepté de recevoir nos messages sur WhatsApp.', 'This owner agreed to receive our WhatsApp messages.')}</label>
          <Button disabled={pending || edited || d.messageStale || d.approvalBlocked || !consent || !catalog?.enabled || !approvedSenderAvailable || !message.whatsappTemplate || !message.approvalId || !send} onClick={send}>{t('Envoyer le WhatsApp validé', 'Send approved WhatsApp')}</Button>
        </div>}
        {!!d.deliveries?.length && <DeliveryList deliveries={d.deliveries.slice(0, 1)} />}
        {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
      </div></TabsContent>
      <TabsContent value="history"><div className={sectionClass}><h3 className="font-semibold">{t('Historique des contacts et décisions', 'Contact and decision history')}</h3>
        <DeliveryList deliveries={d.deliveries ?? []} />
        {!d.history.items.length && <p className="text-sm text-slate-500">{t('Aucun contact ni message enregistré.', 'No contact or message recorded.')}</p>}
        {d.history.items.map(event => <HistoryEvent key={event.id} event={event} />)}
        <Pager {...d.history} change={historyPage} pending={pending} t={t} />
      </div></TabsContent>
    </Tabs>
  </div>;
}
function HistoryEvent({ event }: { event: ContactHistoryEvent }) {
  const { t, date } = useCopy(); const data = event.data;
  return <article className="space-y-2 border-t pt-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{label(data.action, t)}</p><p className="text-xs text-slate-500">{date(event.createdAt, true)} · {event.actorName}</p></div>
    {data.action === 'contact' && <p>{label(data.channel, t)} · {label(data.outcome, t)} · {date(data.contactAt, true)}</p>}
    {(data.action === 'contact' || data.action === 'plan') && <><p className="whitespace-pre-wrap break-words">{data.note}</p><p className="text-xs text-slate-600">{label(data.status, t)} · {data.nextAction ? `${date(data.nextActionDate)} · ${data.nextAction}` : t('Aucune prochaine action', 'No next action')}</p></>}
    {data.action === 'delivery' && <div className="space-y-1"><p>{deliveryLabel(data.status, t)} · {data.recipient}</p>{data.sender && <p>{t('Expéditeur', 'Sender')} : {data.sender.name} · {data.sender.phoneNumber}</p>}{data.errorCode && <p className="text-xs">{t('Référence de l’erreur', 'Error reference')} : {data.errorCode}</p>}{data.text && <details><summary>{t('Voir le texte prévu pour l’envoi', 'View the text prepared for sending')}</summary><p className="whitespace-pre-wrap break-words">{data.text}</p></details>}</div>}
    {data.action === 'save_message' && <details><summary className="cursor-pointer text-cyan-800">{t('Voir le texte enregistré', 'View saved text')} · {label(data.channel, t)}</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3">{data.text}</p></details>}
  </article>;
}

function deliveryLabel(status: DeliveryStatus, t: Copy) {
  return ({ dispatching: t('Envoi en cours', 'Sending'), accepted: t('Accepté par WhatsApp · livraison en attente', 'Accepted by WhatsApp · awaiting delivery'), sent: t('Envoyé', 'Sent'), delivered: t('Livré', 'Delivered'), read: t('Lu', 'Read'), failed: t('Échec de l’envoi', 'Sending failed'), unknown: t('Résultat incertain · à vérifier', 'Unknown result · check required') })[status];
}
function DeliveryList({ deliveries }: { deliveries: ContactDetail['deliveries'] }) {
  const { t, date } = useCopy();
  return <div className="space-y-3">{deliveries.map(item => <article key={item.id} className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm">
    <p className="font-semibold">WhatsApp · {deliveryLabel(item.status, t)}</p>
    {item.sender && <p className="break-words">{t('Expéditeur', 'Sender')} : {item.sender.name} · {item.sender.phoneNumber}</p>}
    <p className="break-words">{item.recipient} · {date(item.createdAt, true)} · {item.actorName}</p>
    <p className="text-xs text-slate-600">{t('Statut mis à jour', 'Status updated')} : {date(item.updatedAt, true)}</p>
    {item.status === 'unknown' && <p className="text-amber-900">{t('Le fournisseur n’a pas confirmé le résultat. Aucun nouvel essai automatique : vérifie cet envoi avant de relancer.', 'The provider has not confirmed the outcome. No automatic retry: check this send before following up.')}</p>}
    {item.errorCode && <p>{t('Référence de l’erreur', 'Error reference')} : {item.errorCode}</p>}
    <details><summary className="cursor-pointer text-cyan-800">{t('Voir le message et sa référence', 'View message and reference')}</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.text}</p><p className="mt-2 break-all text-xs">{item.providerId || item.id}</p></details>
  </article>)}</div>;
}
