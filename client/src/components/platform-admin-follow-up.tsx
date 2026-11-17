import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DecisionAccount, DecisionReceipt, DecisionRegistration, FollowUpReason, FollowUpStatus, RevenueScope } from '@shared/platform-admin-decision';

const PAGE_SIZE = 10;
type OpenAccount = (account: DecisionAccount) => void;
type Translate = (fr: string, en: string) => string;
const statusCopy: Record<FollowUpStatus, [string, string]> = {
  new: ['Nouveau', 'New'], support: ['À accompagner', 'Needs support'],
  payment_review: ['Paiement à vérifier', 'Review payment'], subscription: ['À relancer · abonnement', 'Follow up · subscription'],
  renewal: ['À relancer · renouvellement', 'Follow up · renewal'], active: ['Accès en cours', 'Current access'], watch: ['Démarrage à suivre', 'Monitor onboarding'],
};
const reasonCopy: Record<FollowUpReason, [string, string]> = {
  recent_signup: ['Inscrit depuis moins de 48 h, aucune commande : proposer un premier contact.', 'Registered less than 48 hours ago, no orders: offer an introduction.'],
  no_orders: ['Aucune commande non annulée après 48 h : aider à enregistrer la première commande.', 'No non-cancelled order after 48 hours: help create the first order.'],
  stopped_ordering: ['Aucune commande non annulée depuis au moins 7 jours : demander ce qui bloque.', 'No non-cancelled order for at least 7 days: ask what is blocking progress.'],
  payment_issue: ['Un paiement nécessite une vérification avant toute relance commerciale.', 'A payment needs checking before any sales follow-up.'],
  trial_ending: ['Usage régulier et essai se terminant sous 7 jours : proposer la formule adaptée.', 'Regular usage and trial ending within 7 days: discuss a suitable plan.'],
  free_regular: ['Usage régulier en formule gratuite : vérifier le besoin d’une formule payante.', 'Regular usage on a free plan: check whether a paid plan is needed.'],
  renewal_due: ['Formule payante à échéance sous 7 jours et paiement commercial déjà confirmé : vérifier le renouvellement.', 'Paid plan ending within 7 days with a confirmed commercial payment: check renewal.'],
  paid_access: ['Accès à une formule payante en cours, y compris offert ou historique.', 'Current access to a paid plan, including gifted or historical access.'],
  prepaid_trial: ['Paiement commercial confirmé pendant l’essai : vérifier la période acquise dans la fiche.', 'Commercial payment confirmed during the trial: check the acquired period in the account.'],
  getting_started: ['Premières commandes enregistrées : suivre la prise en main.', 'First orders recorded: monitor onboarding.'],
};

function useCopy() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const t: Translate = (a, b) => fr ? a : b;
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', {
    dateStyle: 'medium', timeZone: 'Africa/Douala',
  }).format(new Date(value)) : '—';
  const money = (value: number) => new Intl.NumberFormat(fr ? 'fr-CM' : 'en-CM', {
    style: 'currency', currency: 'XAF', maximumFractionDigits: 0,
  }).format(value);
  return { t, date, money };
}

function Pagination({ page, total, change, t }: { page: number; total: number; change: (page: number) => void; t: Translate }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-slate-600">
    <span>{total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} / ${total}` : '0'}</span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={!page} onClick={() => change(page - 1)}>{t('Précédent', 'Previous')}</Button>
      <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => change(page + 1)}>{t('Suivant', 'Next')}</Button>
    </div>
  </div>;
}

export function RevenuePressings({ receipts, scope, setScope, open }: {
  receipts: DecisionReceipt[]; scope: RevenueScope; setScope: (scope: RevenueScope) => void; open: OpenAccount;
}) {
  const { t, date, money } = useCopy();
  const [page, setPage] = useState(0);
  const rows = receipts.filter(row => scope === 'previous' ? row.period === 'previous' && !row.pilot
    : row.period === 'current' && (scope === 'pilots' ? row.pilot : !row.pilot && (scope !== 'renewals' || row.kind === 'renewal')));
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const kinds: Record<DecisionReceipt['kind'], string> = {
    cycle: t('Abonnement', 'Subscription'), renewal: t('Renouvellement', 'Renewal'), upgrade: t('Changement de formule', 'Plan upgrade'),
    options: t('Options', 'Add-ons'), unknown: t('Nature non renseignée', 'Type unavailable'),
  };
  return <section aria-label={t('Pressings et paiements confirmés', 'Pressings and confirmed payments')} className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{t('Pressings et paiements confirmés', 'Pressings and confirmed payments')}</h3>
      <label className="text-sm">{t('Montant détaillé', 'Amount breakdown')}
        <select className="ml-2 max-w-full rounded-md border bg-white p-2" value={scope} onChange={event => { setPage(0); setScope(event.target.value as RevenueScope); }}>
          <option value="commercial">{t('Encaissements commerciaux', 'Commercial receipts')}</option>
          <option value="previous">{t('Période précédente', 'Previous period')}</option>
          <option value="pilots">{t('Pilotes', 'Pilots')}</option>
          <option value="renewals">{t('Renouvellements commerciaux', 'Commercial renewals')}</option>
        </select>
      </label>
    </div>
    <p className="text-sm text-slate-600">{rows.length} {t('paiements', 'payments')} · {new Set(rows.map(row => row.organisationId)).size} {t('pressings', 'pressings')} · <strong>{money(rows.reduce((sum, row) => sum + row.amount, 0))}</strong></p>
    <div className="overflow-x-auto" role="region" aria-label={t('Détail des encaissements', 'Receipt details')} tabIndex={0}>
      <table className="w-full min-w-[460px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>
          <th scope="col" className="p-2">{t('Pressing / paiement', 'Pressing / payment')}</th><th scope="col" className="p-2">{t('Formule / nature', 'Plan / type')}</th><th scope="col" className="p-2 text-right">{t('Encaissé', 'Received')}</th>
        </tr></thead>
        <tbody className="divide-y">{rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE).map(row => <tr key={row.id}>
          <td className="p-2 align-top"><button className="break-words text-left font-semibold text-cyan-800 underline underline-offset-2" onClick={() => open({ id: row.organisationId, name: row.name })}>{row.name} →</button><p className="mt-1 text-xs text-slate-500">{date(row.paidAt)}</p></td>
          <td className="p-2 align-top">{row.planName ?? t('Formule non renseignée', 'Plan unavailable')}<p className="mt-1 text-xs text-slate-500">{row.pilot ? t('Pilote', 'Pilot') : kinds[row.kind]}</p></td>
          <td className="whitespace-nowrap p-2 text-right align-top font-semibold">{money(row.amount)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p className="py-3 text-sm text-slate-500">{t('Aucun paiement confirmé dans cette sélection.', 'No confirmed payment in this selection.')}</p>}
    <Pagination page={safePage} total={rows.length} change={setPage} t={t} />
  </section>;
}

export function NewRegistrations({ registrations, days, open, openContact }: { registrations: DecisionRegistration[]; days: number; open: OpenAccount; openContact?: OpenAccount }) {
  const { t, date } = useCopy();
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [page, setPage] = useState(0);
  const term = search.trim().toLocaleLowerCase();
  const rows = registrations.filter(row => (segment === 'all' || (segment === 'no_orders' ? row.activity.orders === 0 : row.followUp.status === segment))
    && [row.name, row.owner.name, row.owner.email, row.owner.phone].some(value => value?.toLocaleLowerCase().includes(term)));
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const visible = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const followUp = (row: DecisionRegistration) => <>
    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${row.followUp.status === 'payment_review' ? 'bg-red-50 text-red-800' : ['support', 'subscription', 'renewal'].includes(row.followUp.status) ? 'bg-amber-50 text-amber-900' : 'bg-cyan-50 text-cyan-900'}`}>{t(...statusCopy[row.followUp.status])}</span>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">{t(...reasonCopy[row.followUp.reason])}</p>
    {openContact && <Button variant="outline" size="sm" className="mt-3 whitespace-normal" onClick={() => openContact(row)}>{t('Suivi et message', 'Follow-up and message')}</Button>}
  </>;
  const identity = (row: DecisionRegistration) => <>
    <button className="break-words text-left font-semibold text-cyan-800 underline underline-offset-2" onClick={() => open(row)}>{row.name} →</button>
    <p className="mt-1 text-xs text-slate-500">{date(row.createdAt)} · {row.ageDays} {t('j', 'd')}</p>
    <p className="mt-2 break-words text-sm">{row.owner.name || t('Responsable non renseigné', 'Owner name unavailable')}</p>
    <p className="break-all text-xs text-slate-500">{row.owner.phone || t('Téléphone non renseigné', 'Phone unavailable')}</p>
    <p className="break-all text-xs text-slate-500">{row.owner.email || t('Email non renseigné', 'Email unavailable')}</p>
  </>;
  const activity = (row: DecisionRegistration) => <>
    <p><strong>{row.activity.orders}</strong> {t('au total', 'total')}</p>
    <p className="mt-1 text-xs text-slate-600"><strong>{row.activity.orders7}</strong> {t('sur 7 jours', 'over 7 days')} · {row.activity.activeDays7} {t('jours actifs', 'active days')}</p>
  </>;
  const subscription = (row: DecisionRegistration) => <>
    <p className="font-medium">{row.subscription.planName || t('Sans formule', 'No plan')}</p>
    <p className="mt-1 text-xs text-slate-600">{row.subscription.status === 'trial' ? t('Essai', 'Trial') : row.subscription.paidAccess ? t('Accès à une formule payante', 'Paid-plan access') : row.subscription.status === 'active' ? t('Formule gratuite', 'Free plan') : t('Accès à vérifier', 'Check access')}</p>
    {row.subscription.endDate && <p className="mt-1 text-xs text-slate-500">{t('Échéance', 'Ends')} : {date(row.subscription.endDate)}</p>}
    <p className="mt-2 text-xs text-slate-500">{row.subscription.lastPaymentAt ? `${t('Dernier paiement commercial', 'Last commercial payment')} : ${date(row.subscription.lastPaymentAt)}` : t('Aucun paiement commercial confirmé', 'No confirmed commercial payment')}</p>
  </>;
  return <Card className="min-w-0 border-slate-200 shadow-sm xl:col-span-2">
    <CardHeader><CardTitle className="text-lg">{t('Nouveaux inscrits et activité', 'New registrations and activity')}</CardTitle>
      <p className="text-sm text-slate-600">{registrations.length} {t('pressings inscrits sur les', 'pressings registered over the last')} {days} {t('derniers jours · activité observée jusqu’à maintenant.', 'days · activity observed until now.')}</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label={t('Filtres rapides de suivi', 'Quick follow-up filters')}>
        {(['all', 'support', 'subscription', 'payment_review'] as const).map(value => <Button key={value} variant={segment === value ? 'default' : 'outline'} size="sm" aria-pressed={segment === value} onClick={() => { setSegment(value); setPage(0); }}>
          {value === 'all' ? t('Tous', 'All') : t(...statusCopy[value])} · {value === 'all' ? registrations.length : registrations.filter(row => row.followUp.status === value).length}
        </Button>)}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-xs text-slate-600">{t('Rechercher un pressing ou son responsable', 'Search pressing or owner')}
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900" placeholder={t('Nom, téléphone ou email', 'Name, phone or email')} />
        </label>
        <label className="text-xs text-slate-600">{t('Suivi proposé', 'Suggested follow-up')}
          <select value={segment} onChange={event => { setSegment(event.target.value); setPage(0); }} className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900">
            <option value="all">{t('Tous les inscrits', 'All registrations')}</option><option value="no_orders">{t('Aucune commande', 'No orders')}</option>
            {(Object.keys(statusCopy) as FollowUpStatus[]).map(value => <option key={value} value={value}>{t(...statusCopy[value])}</option>)}
          </select>
        </label>
      </div>
      <div className="hidden overflow-x-auto md:block" role="region" aria-label={t('Tableau des nouveaux inscrits', 'New registrations table')} tabIndex={0}>
        <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>{[
            t('Pressing / responsable', 'Pressing / owner'), t('Commandes non annulées', 'Non-cancelled orders'), t('Première / dernière commande', 'First / last order'), t('Abonnement / paiement', 'Subscription / payment'), t('Suivi proposé', 'Suggested follow-up'),
          ].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y">{visible.map(row => <tr key={row.id} className="hover:bg-slate-50">
            <td className="p-3 align-top">{identity(row)}</td><td className="p-3 align-top">{activity(row)}</td>
            <td className="p-3 align-top"><p>{t('Première', 'First')} : {date(row.activity.firstOrderAt)}</p><p className="mt-2">{t('Dernière', 'Last')} : {date(row.activity.lastOrderAt)}</p>{row.activity.daysSinceLastOrder !== null && <p className="mt-1 text-xs text-slate-500">{row.activity.daysSinceLastOrder} {t('j depuis la dernière', 'd since last order')}</p>}</td>
            <td className="p-3 align-top">{subscription(row)}</td><td className="p-3 align-top">{followUp(row)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{visible.map(row => <article key={row.id} className="space-y-3 rounded-xl border p-4">
        <div>{identity(row)}</div><div>{followUp(row)}</div>
        <div className="border-t pt-3 text-sm"><p className="mb-1 text-xs text-slate-500">{t('Commandes non annulées', 'Non-cancelled orders')}</p>{activity(row)}
          <p className="mt-2 text-xs">{t('Première', 'First')} : {date(row.activity.firstOrderAt)} · {t('Dernière', 'Last')} : {date(row.activity.lastOrderAt)}</p>
        </div><div className="border-t pt-3 text-sm">{subscription(row)}</div>
      </article>)}</div>
      {!rows.length && <p className="py-5 text-center text-sm text-slate-500">{t('Aucun pressing ne correspond à cette période et à ces filtres.', 'No pressing matches this period and these filters.')}</p>}
      <Pagination page={safePage} total={rows.length} change={setPage} t={t} />
      <details className="text-xs text-slate-500"><summary className="cursor-pointer">{t('Comment le suivi est-il proposé ?', 'How is follow-up suggested?')}</summary>
        <p className="mt-2 leading-relaxed">{t('Une ligne par organisation, toutes ses boutiques réunies. Commandes comptées à leur enregistrement, hors annulations ; les commandes de démonstration non identifiées peuvent être incluses. Les 7 jours sont calendaires, Africa/Douala, journée en cours partielle. Usage régulier : au moins 3 commandes sur 2 jours distincts sur cette fenêtre. Aide au démarrage après 48 h sans commande ; reprise de contact après 7 jours sans commande. Relance d’abonnement : usage régulier et essai finissant sous 7 jours, ou formule gratuite dont le besoin payant reste à confirmer. Les suggestions ne tiennent pas encore compte de vos échanges et n’envoient aucun message.', 'One row per organisation, all its sites combined. Orders are counted when recorded, excluding cancellations; unmarked demonstration orders may be included. The 7 days are calendar days in Africa/Douala, with a partial current day. Regular usage: at least 3 orders on 2 distinct days in this window. Onboarding help after 48 hours without orders; reconnect after 7 days without an order. Subscription follow-up: regular usage with a trial ending within 7 days, or a free plan whose paid needs still require confirmation. Suggestions do not yet consider your conversations and send no messages.')}</p>
      </details>
    </CardContent>
  </Card>;
}
