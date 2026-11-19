import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { capacityCost, type CapacityCost, type CapacitySummary, type CapacityChange, type CapacityPreview } from '@shared/admin-capacity';

export function capacityError(code: string, fr: boolean) {
  const errors: Record<string, [string, string]> = {
    ADMIN_ORGANISATION_EXCLUDED: ['Compte temporairement exclu : droits conservés, modification indisponible.', 'Temporarily excluded account: existing rights are preserved; changes are unavailable.'],
    ADMIN_LEGACY_REVIEW_REQUIRED: ['Les droits de cet abonnement historique doivent être vérifiés avant toute modification.', 'Review this historical subscription before changing its rights.'],
    ADMIN_ACTIVE_PLAN_REQUIRED: ['L’activation manuelle nécessite une formule Pro ou Business active. Vous pouvez attribuer une formule dans la section ci-dessous. Les accès de l’essai sont gérés automatiquement.', 'Manual activation requires an active Pro or Business plan. You can assign a plan in the section below. Trial access is managed automatically.'],
    ADMIN_SCHEDULED_CHANGE_REQUIRES_REVIEW: ['Une période déjà réservée ou un changement programmé nécessite une vérification avant cet ajout.', 'Review the reserved period or scheduled change before adding capacity.'],
    ADMIN_PAYMENT_PENDING: ['Un paiement est en attente ou en vérification. Résolvez-le avant de modifier les droits.', 'Resolve the pending payment or payment review before changing access.'],
    ADMIN_STATE_CHANGED: ['Les droits ou les rattachements ont changé. Actualisez puis prévisualisez à nouveau.', 'Access or memberships changed. Refresh and preview again.'],
    ADMIN_ACQUIRED_RIGHTS_PROTECTED: ['Cette action permet uniquement d’ajouter des places et conserve les droits existants.', 'This action only adds capacity and preserves existing rights.'],
    ADMIN_ACCESS_SELECTION_INVALID: ['Vérifiez les boutiques et le rattachement du personnel sélectionné.', 'Check the selected sites and staff memberships.'],
    ADMIN_CAPACITY_EXCEEDED: ['Ajoutez assez de places pour les accès sélectionnés.', 'Add enough capacity for the selected access.'],
    ADMIN_CAPACITY_UNCHANGED: ['Ajoutez une place ou sélectionnez un accès à activer.', 'Add capacity or select access to activate.'],
    ADMIN_CAPACITY_INPUT_INVALID: ['Vérifiez les quantités et renseignez un motif de 10 à 500 caractères.', 'Check the quantities and enter a reason of 10–500 characters.'],
    BUSINESS_REQUIRED: ['Business est requis pour exploiter plusieurs boutiques.', 'Business is required to operate multiple sites.'],
    ADMIN_REAUTH_REQUIRED: ['Reconnectez-vous au superadmin avant de continuer.', 'Sign in to Super Admin again to continue.'],
  };
  return errors[code]?.[fr ? 0 : 1] ?? (fr ? 'Impossible de terminer cette opération. Actualisez puis réessayez.' : 'Unable to complete this operation. Refresh and try again.');
}
const money = (value: number, fr: boolean) => `${value.toLocaleString(fr ? 'fr-FR' : 'en-GB')} FCFA`;
function CostRows({ cost, fr }: { cost: CapacityCost; fr: boolean }) {
  return <dl className="space-y-2 text-sm">
    <div className="flex justify-between gap-3"><dt>{fr ? 'Formule' : 'Plan'} {cost.selection.plan === 'business' ? 'Business' : cost.selection.plan === 'pro' ? 'Pro' : 'Starter'}</dt><dd className="shrink-0 whitespace-nowrap">{money(cost.baseXaf, fr)}</dd></div>
    <div className="flex justify-between gap-3"><dt>{cost.selection.extraSites} × {fr ? 'boutique supplémentaire' : 'additional site'} · 5 000 FCFA</dt><dd className="shrink-0 whitespace-nowrap">{money(cost.sitesXaf, fr)}</dd></div>
    <div className="flex justify-between gap-3"><dt>{cost.selection.extraStaff} × {fr ? 'place de personnel supplémentaire' : 'additional staff place'} · 2 000 FCFA</dt><dd className="shrink-0 whitespace-nowrap">{money(cost.staffXaf, fr)}</dd></div>
    <div className="flex justify-between gap-3 border-t pt-2 font-semibold"><dt>{fr ? 'Tarif mensuel de référence' : 'Reference monthly price'}</dt><dd className="shrink-0 whitespace-nowrap">{money(cost.monthlyXaf, fr)}</dd></div>
  </dl>;
}
export function CapacityRecap({ data, fr }: { data: CapacitySummary; fr: boolean }) {
  const cost = data.current;
  const invoice = data.latestInvoice;
  const statuses: Record<string, string> = fr ? { quoted: 'Devis non payé', pending: 'Paiement en attente', paid: 'Payé', failed: 'Paiement non abouti', expired: 'Devis expiré', review: 'Paiement à vérifier' }
    : { quoted: 'Unpaid quote', pending: 'Payment pending', paid: 'Paid', failed: 'Payment unsuccessful', expired: 'Quote expired', review: 'Payment under review' };
  const lineNames: Record<string, string> = fr ? { plan: 'Formule', sites: 'Boutiques supplémentaires', staff: 'Places de personnel supplémentaires', creditPro: 'Crédit Pro', creditStaff: 'Crédit personnel' }
    : { plan: 'Plan', sites: 'Additional sites', staff: 'Additional staff places', creditPro: 'Pro credit', creditStaff: 'Staff credit' };
  return <div className="space-y-5">
    <div><h3 className="font-semibold">{fr ? 'Boutiques, personnel et coût' : 'Sites, staff and cost'}</h3><p className="mt-1 text-sm text-slate-600">{fr ? 'Les places autorisées et les accès utilisés sont distingués. Le propriétaire ne compte pas dans les places de personnel.' : 'Authorised capacity and access in use are shown separately. The owner does not use a staff place.'}</p></div>
    {cost ? <>
      <p className="text-sm font-medium text-cyan-800">{data.phase === 'trialing' ? (fr ? 'Capacité de l’essai gratuit' : 'Free trial capacity') : data.phase === 'starter' ? (fr ? 'Droits actuels · Starter gratuit' : 'Current access · free Starter') : (fr ? 'Droits de la période active · souscrits ou accordés manuellement' : 'Current period access · subscribed or manually granted')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CapacityCard title={fr ? 'Boutiques' : 'Sites'} included={cost.includedSites} extra={cost.selection.extraSites} used={data.usedSites} total={cost.totalSites} registered={data.sites.length} fr={fr}/>
        <CapacityCard title={fr ? 'Personnel' : 'Staff'} included={cost.includedStaff} extra={cost.selection.extraStaff} bundled={cost.staffFromExtraSites} used={data.usedStaff} total={cost.totalStaff} registered={data.staff.length} fr={fr}/>
      </div>
      <CostRows cost={cost} fr={fr}/>
      <p className="text-xs text-slate-500">{fr ? 'Ce tarif de référence n’est pas un paiement encaissé. Au renouvellement, seules les places de personnel supplémentaires utilisées sont facturées. Une promotion peut modifier le devis.' : 'This reference price is not a collected payment. At renewal, only additional staff places in use are billed. A promotion may change the quote.'}</p>
    </> : <p className="rounded-lg bg-amber-50 p-3 text-sm">{capacityError(data.activationBlockedReason ?? 'ADMIN_LEGACY_REVIEW_REQUIRED', fr)}</p>}
    {data.next && <div className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">{data.next.kind === 'renewal' ? (fr ? 'Prochaine période déjà réservée' : 'Next period already reserved') : (fr ? 'Changement prévu à l’échéance' : 'Scheduled change at renewal')}</h4><p className="text-sm">{data.next.cost.totalSites} {fr ? 'boutiques' : 'sites'} · {data.next.cost.totalStaff} {fr ? 'places de personnel' : 'staff places'}</p><CostRows cost={data.next.cost} fr={fr}/></div>}
    {invoice && <details className="rounded-xl border border-slate-200 p-4" open><summary className="cursor-pointer font-semibold">{fr ? 'Dernier devis / paiement' : 'Latest quote / payment'} · {statuses[invoice.status] ?? invoice.status}</summary>
      <div className="mt-3 space-y-3 text-sm"><p>{new Date(invoice.createdAt).toLocaleString(fr ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Douala' })} · {invoice.durationMonths} {fr ? 'mois · heure de Douala' : 'month(s) · Douala time'}</p>
        {invoice.cost && <p>{invoice.cost.totalSites} {fr ? 'boutique(s)' : 'site(s)'} · {invoice.cost.totalStaff} {fr ? 'places de personnel, dont' : 'staff places, including'} <strong>{invoice.cost.selection.extraStaff} {fr ? 'supplémentaires' : 'additional'}</strong>{invoice.cost.staffFromExtraSites > 0 && ` + ${invoice.cost.staffFromExtraSites} ${fr ? 'liées aux boutiques supplémentaires' : 'bundled with additional sites'}`}</p>}
        <dl className="space-y-2">{invoice.lines.map((line, index) => <div key={index} className="flex justify-between gap-3"><dt>{lineNames[line.label] ?? line.label} × {line.quantity}</dt><dd className="shrink-0 whitespace-nowrap">{money(line.amountXaf, fr)}</dd></div>)}
          <div className="flex justify-between gap-3"><dt>{fr ? 'Montant avant promotion' : 'Before promotion'}</dt><dd className="shrink-0 whitespace-nowrap">{money(invoice.originalXaf, fr)}</dd></div>
          {invoice.promoCode && <div className="flex justify-between gap-3 text-emerald-800"><dt>{fr ? 'Code promo' : 'Promo code'} {invoice.promoCode}</dt><dd className="shrink-0 whitespace-nowrap">−{money(invoice.discountXaf, fr)}</dd></div>}
          <div className="flex justify-between gap-3 border-t pt-2 font-semibold"><dt>{fr ? 'Total du devis' : 'Quote total'}</dt><dd className="shrink-0 whitespace-nowrap">{money(invoice.totalXaf, fr)}</dd></div>
        </dl><p className="text-xs text-slate-500">{fr ? 'Les options de ce devis ne prouvent pas que les droits ont été activés. Consultez les droits actuels ci-dessus.' : 'Options in this quote do not prove that access was activated. See current access above.'}</p>
      </div>
    </details>}
  </div>;
}
function CapacityCard({ title, included, extra, bundled = 0, used, total, registered, fr }: { title: string; included: number; extra: number; bundled?: number; used: number; total: number; registered: number; fr: boolean }) {
  return <div className="rounded-xl bg-slate-50 p-4"><h4 className="font-semibold">{title}</h4><p className="mt-2 text-2xl font-bold">{used} <span className="text-base font-normal text-slate-500">/ {total}</span></p><p className="text-xs text-slate-500">{fr ? 'accès utilisés / autorisés' : 'access in use / authorised'}</p><dl className="mt-3 space-y-1 text-sm"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><dt>{fr ? 'Inclus dans la formule' : 'Included in plan'}</dt><dd className="text-right tabular-nums">{included}</dd></div><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><dt>{fr ? 'Supplémentaires souscrits / accordés' : 'Additional subscribed / granted'}</dt><dd className="text-right tabular-nums">{extra}</dd></div>{bundled > 0 && <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><dt>{fr ? 'Inclus avec les boutiques supplémentaires' : 'Bundled with additional sites'}</dt><dd className="text-right tabular-nums">{bundled}</dd></div>}<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><dt>{fr ? 'Enregistrés dans l’organisation' : 'Registered in organisation'}</dt><dd className="text-right tabular-nums">{registered}</dd></div></dl></div>;
}
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(response.status === 401 ? 'ADMIN_REAUTH_REQUIRED' : result.message ?? 'ADMIN_CAPACITY_FAILED');
  return result;
}
export default function AdminOrganisationCapacity({ organisationId }: { organisationId: number }) {
  const { i18n } = useTranslation(); const fr = i18n.language.startsWith('fr');
  const [activated, setActivated] = useState(false);
  const query = useQuery<CapacitySummary>({ queryKey: ['/api/platform-admin/organisations', organisationId, 'capacity'], queryFn: () => request(`/api/platform-admin/organisations/${organisationId}/capacity`), staleTime: 0 });
  return <section className="mb-5 space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5" data-testid="admin-capacity">
    <div className="flex justify-end"><Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{fr ? 'Actualiser les droits' : 'Refresh access'}</Button></div>
    {query.isLoading && <p role="status">{fr ? 'Chargement des droits…' : 'Loading access…'}</p>}
    {query.error && <p role="alert">{capacityError(query.error.message, fr)}</p>}
    {activated && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{fr ? 'Places et accès activés. Aucun paiement enregistré.' : 'Capacity and access activated. No payment recorded.'}</p>}
    {query.data && <><CapacityRecap data={query.data} fr={fr}/>{query.data.activationBlockedReason ? <p className="rounded-lg bg-amber-50 p-3 text-sm">{capacityError(query.data.activationBlockedReason, fr)}</p> : <CapacityActivation key={query.data.fingerprint} data={query.data} fr={fr} onActivated={() => setActivated(true)}/>}</>}
  </section>;
}

function CapacityActivation({ data, fr, onActivated }: { data: CapacitySummary; fr: boolean; onActivated: () => void }) {
  const client = useQueryClient(); const current = data.current!;
  const [extraSites, setExtraSites] = useState(current.selection.extraSites), [extraStaff, setExtraStaff] = useState(current.selection.extraStaff);
  const [siteIds, setSiteIds] = useState<number[]>([]), [staffIds, setStaffIds] = useState<string[]>([]), [reason, setReason] = useState('');
  const [review, setReview] = useState<{ input: CapacityChange; result: CapacityPreview } | null>(null);
  const preview = useMutation({ mutationFn: async (input: CapacityChange) => ({ input, result: await request<CapacityPreview>(`/api/platform-admin/organisations/${data.organisationId}/capacity-preview`, input) }), onSuccess: setReview });
  const activate = useMutation({ mutationFn: () => request<CapacityPreview>(`/api/platform-admin/organisations/${data.organisationId}/capacity`, review!.input), onSuccess: async () => {
    setReview(null); onActivated();
    await Promise.all([
      client.invalidateQueries({ queryKey: ['/api/platform-admin/organisations', data.organisationId] }),
      ...['overview', 'decision-overview', 'subscribers', 'audit-events'].map(key => client.invalidateQueries({ queryKey: [`/api/platform-admin/${key}`] })),
    ]);
  } });
  const busy = preview.isPending || activate.isPending;
  function changed(fn: () => void) { fn(); setReview(null); preview.reset(); activate.reset(); }
  function submit(event: FormEvent) { event.preventDefault(); preview.mutate({ expectedFingerprint: data.fingerprint!, extraSites, extraStaff, addSiteIds: siteIds, addStaffIds: staffIds, reason: reason.trim() }); }
  const chosenSites = [...data.sites.filter(s => s.enabled).map(s => s.id), ...siteIds];
  const cost = Number.isInteger(extraSites) && Number.isInteger(extraStaff) && extraSites >= 0 && extraStaff >= 0 && extraSites <= 1000 && extraStaff <= 1000 ? capacityCost({ ...current.selection, extraSites, extraStaff }) : null;
  return <details className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4"><summary className="cursor-pointer font-semibold">{fr ? 'Ajouter des places et activer des accès' : 'Add capacity and activate access'}</summary>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <p className="text-sm">{fr ? 'Attribution manuelle pour la période en cours, jusqu’à l’échéance actuelle. Aucun encaissement automatique. Les droits existants sont conservés.' : 'Manual grant for the current period, until its existing end date. No automatic charge. Existing rights are preserved.'}</p>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm">{fr ? 'Total de boutiques supplémentaires' : 'Total additional sites'}<Input type="number" min={current.selection.extraSites} max={1000} step={1} required value={Number.isFinite(extraSites) ? extraSites : ''} disabled={current.selection.plan !== 'business'} onChange={e => changed(() => setExtraSites(e.target.valueAsNumber))}/><span className="text-xs text-slate-500">{fr ? 'Business : au-delà des 2 incluses. Chaque boutique ajoute aussi 2 places de personnel.' : 'Business: beyond the 2 included. Each site also adds 2 staff places.'}</span></label>
          <label className="grid gap-2 text-sm">{fr ? 'Total de places de personnel supplémentaires' : 'Total additional staff places'}<Input type="number" min={current.selection.extraStaff} max={1000} step={1} required value={Number.isFinite(extraStaff) ? extraStaff : ''} onChange={e => changed(() => setExtraStaff(e.target.valueAsNumber))}/><span className="text-xs text-slate-500">{fr ? 'En plus des places incluses dans la formule et les boutiques supplémentaires.' : 'Beyond the places included in the plan and additional sites.'}</span></label>
        </div>
        {cost && <p className="rounded-lg bg-white p-3 text-sm">{fr ? 'Après attribution :' : 'After grant:'} <strong>{cost.totalSites} {fr ? 'boutiques' : 'sites'} · {cost.totalStaff} {fr ? 'places de personnel' : 'staff places'} · {money(cost.monthlyXaf, fr)} / {fr ? 'mois de référence' : 'reference month'}</strong></p>}
        <div className="grid gap-4 sm:grid-cols-2"><div><h4 className="mb-2 text-sm font-semibold">{fr ? 'Boutiques à activer' : 'Sites to activate'}</h4>{data.sites.map(site => <label key={site.id} className="mb-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={site.enabled || !site.available} checked={site.enabled || siteIds.includes(site.id)} onChange={e => changed(() => { const next = e.target.checked ? [...siteIds, site.id] : siteIds.filter(id => id !== site.id); setSiteIds(next); setStaffIds(staffIds.filter(id => data.staff.find(p => p.id === id)!.siteIds.some(s => data.sites.some(t => t.id === s && t.enabled) || next.includes(s)))); })}/><span>{site.name} · {site.enabled ? (fr ? 'accès actif' : 'access active') : !site.available ? (fr ? 'boutique désactivée' : 'site disabled') : (fr ? 'accès non activé' : 'access inactive')}</span></label>)}</div>
          <div><h4 className="mb-2 text-sm font-semibold">{fr ? 'Personnel à activer' : 'Staff to activate'}</h4>{data.staff.map(person => { const eligible = person.siteIds.some(id => chosenSites.includes(id)); return <label key={person.id} className="mb-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={person.enabled || !eligible} checked={person.enabled || staffIds.includes(person.id)} onChange={e => changed(() => setStaffIds(e.target.checked ? [...staffIds, person.id] : staffIds.filter(id => id !== person.id)))}/><span>{person.name} · {person.enabled ? (fr ? 'accès actif' : 'access active') : !eligible ? (fr ? 'rattachement à une boutique active requis' : 'active site membership required') : (fr ? 'accès non activé' : 'access inactive')}</span></label>; })}{!data.staff.length && <p className="text-sm text-slate-500">{fr ? 'Aucun compte de personnel enregistré.' : 'No staff accounts registered.'}</p>}</div></div>
        <label className="grid gap-2 text-sm">{fr ? 'Motif de l’attribution' : 'Reason for grant'}<Textarea required minLength={10} maxLength={500} value={reason} onChange={e => changed(() => setReason(e.target.value))}/></label>
        <Button type="submit" disabled={reason.trim().length < 10}>{preview.isPending ? (fr ? 'Vérification…' : 'Checking…') : (fr ? 'Prévisualiser l’activation' : 'Preview activation')}</Button>
      </fieldset>
      {(preview.error || activate.error) && <p role="alert" className="text-sm text-red-700">{capacityError((preview.error ?? activate.error)!.message, fr)}</p>}
      {review && <section className="space-y-3 rounded-xl border border-cyan-300 bg-white p-4" aria-label={fr ? 'Confirmation des droits' : 'Access confirmation'}><h4 className="font-semibold">{fr ? 'Vérifier avant activation' : 'Review before activation'}</h4>
        <p className="text-sm">{fr ? 'Places autorisées :' : 'Authorised capacity:'} {review.result.before.totalSites} → {review.result.after.totalSites} {fr ? 'boutiques' : 'sites'} · {review.result.before.totalStaff} → {review.result.after.totalStaff} {fr ? 'personnel' : 'staff'}</p>
        <p className="text-sm">{fr ? 'Accès utilisés :' : 'Access in use:'} {review.result.usedSitesBefore} → {review.result.usedSitesAfter} {fr ? 'boutiques' : 'sites'} · {review.result.usedStaffBefore} → {review.result.usedStaffAfter} {fr ? 'personnel' : 'staff'}</p>
        {[...review.result.addedSites, ...review.result.addedStaff].length > 0 && <p className="text-sm">{fr ? 'Accès à activer :' : 'Access to activate:'} {[...review.result.addedSites, ...review.result.addedStaff].map(item => item.name).join(', ')}</p>}
        <CostRows cost={review.result.after} fr={fr}/><p className="text-sm">{fr ? 'Échéance conservée :' : 'End date preserved:'} {review.result.endsAt ? new Date(review.result.endsAt).toLocaleString(fr ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Douala' }) : '—'}.</p>
        <p className="text-sm">{fr ? 'Aucun paiement ne sera enregistré. Le motif et les changements seront conservés dans l’historique.' : 'No payment will be recorded. The reason and changes will be retained in the audit history.'}</p>
        <Button type="button" disabled={busy} onClick={() => activate.mutate()}>{activate.isPending ? (fr ? 'Activation…' : 'Activating…') : (fr ? 'Confirmer l’activation manuelle' : 'Confirm manual activation')}</Button>
      </section>}
    </form>
  </details>;
}
