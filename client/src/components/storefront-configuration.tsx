import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useCurrency } from "@/hooks/use-currency";
import { GARMENT_LABELS, PILOT_WEIGHTS, SIZE_LABELS, shopInputSchema, type ShopInput } from "@shared/storefront";
import { DEFAULT_BRANDING } from "@shared/storefront-branding";
import type { StorefrontService } from "../../../server/lib/storefront-service";
import { BrandEditor, ImagePicker, ShopHeader, brandStyle } from "./storefront-branding";
import { Message, money, storefrontApi, useStorefrontAction } from "./storefront-ui";
type Admin = Awaited<ReturnType<StorefrontService["admin"]>>;

export function Configuration({ data, onSaved }: { data: Admin; onSaved: () => Promise<unknown> }) {
  const { currency } = useCurrency(), cache = useQueryClient();
  const available = data.availableServices.filter(s => ["piece", "kg"].includes(s.unit));
  const initial = (): ShopInput => data.shop ? {
    ...data.shop, expectedVersion: data.shop.version, currency: data.shop.currency as ShopInput["currency"],
    services: data.shop.services.filter(offer => available.some(s => s.id === offer.serviceId)).map(offer => {
      const unit = available.find(s => s.id === offer.serviceId)!.unit;
      return { ...offer, mode: unit === "kg" ? "kg" : offer.mode === "quote" ? "quote" : "piece" };
    }),
    branding: { ...data.shop.branding, serviceImages: Object.fromEntries(Object.entries(data.shop.branding.serviceImages).filter(([id]) => available.some(s => s.id === Number(id)) && data.shop!.services.some(s => s.serviceId === Number(id)))) },
  } : {
    siteId: data.site.id, expectedVersion: 0,
    slug: `${data.site.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55).replace(/-$/, "") || "pressing"}-${data.site.id}`,
    name: data.site.name, address: data.site.address || "", description: "", hours: "", whatsapp: (data.site.phone || "").replace(/\s/g, ""),
    currency: (data.currency || currency) as ShopInput["currency"], published: false, weightsAcknowledged: false, weights: PILOT_WEIGHTS,
    branding: DEFAULT_BRANDING, services: available.slice(0, 100).map(s => ({ serviceId: s.id, mode: s.unit as "kg" | "piece" })),
  };
  const [form, setForm] = useState<ShopInput>(initial), [step, setStep] = useState(0), [saved, setSaved] = useState(false), [copied, setCopied] = useState(false), [qr, setQr] = useState("");
  const action = useStorefrontAction(), formRef = useRef<HTMLFormElement>(null), title = useRef<HTMLHeadingElement>(null);
  const brand = form.branding ?? DEFAULT_BRANDING;
  const selected = available.filter(s => form.services.some(v => v.serviceId === s.id));
  const hasKg = form.services.some(s => s.mode === "kg");
  const link = `${location.origin}/b/${data.shop?.slug ?? form.slug}`;
  const update = (values: Partial<ShopInput>) => { setForm(f => ({ ...f, ...values })); setSaved(false); action.setError(""); };
  const readyToContinue = () => {
    if (formRef.current?.querySelector('[aria-busy="true"]')) { action.setError("Attendez la fin de la préparation des images."); return false; }
    return formRef.current?.reportValidity() ?? false;
  };
  const navigate = (index: number) => { setStep(index); requestAnimationFrame(() => { title.current?.focus(); title.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }); };
  useEffect(() => { let current = true; QRCode.toDataURL(link, { width: 280, margin: 2 }).then(url => { if (current) setQr(url); }).catch(() => {}); return () => { current = false; }; }, [link]);
  const save = () => action.run(async () => {
    const result = shopInputSchema.safeParse(form);
    if (!result.success) {
      const paths = result.error.issues.map(i => String(i.path[0] ?? ""));
      navigate(paths.some(p => ["name", "whatsapp", "slug", "address", "currency", "branding"].includes(p)) ? 0 : 1);
      throw new Error(result.error.issues.map(i => i.message).join(" · "));
    }
    const shop = await storefrontApi("/api/storefront/admin/current", result.data, "PUT");
    setForm({ ...result.data, branding: shop.branding, expectedVersion: shop.version }); setSaved(true);
    await cache.invalidateQueries({ queryKey: ["/api/auth/user"] }); await onSaved();
  });
  return <div className="sf-config-grid">
    <form ref={formRef} className="sf-stack" onSubmit={e => { e.preventDefault(); if (!readyToContinue()) return; if (step < 2) navigate(step + 1); else void save(); }}>
      <fieldset disabled={action.busy} className="sf-stack sf-fieldset">
        <nav className="sf-steps" aria-label="Création de la boutique">{["Votre boutique", "Vos services", "Ouvrir et partager"].map((label, i) => <button type="button" className="sf-secondary" key={label} aria-current={i === step ? "step" : undefined} onClick={() => { if (readyToContinue()) navigate(i); }}>{i + 1}<span>{label}</span></button>)}</nav>
        {step === 0 && <section className="sf-card sf-stack"><div><span className="sf-eyebrow">Étape 1 sur 3</span><h2 ref={title} tabIndex={-1}>Une boutique à votre image</h2><p className="sf-muted">Les informations de votre agence sont déjà reprises. Ajoutez votre touche personnelle.</p></div>
          <label>Nom de la boutique<input required minLength={2} maxLength={120} value={form.name} onChange={e => update({ name: e.target.value })} /></label>
          <div className="sf-fields"><label>WhatsApp du pressing<input type="tel" autoComplete="tel" required pattern="\+[1-9][0-9]{7,14}" placeholder="+237…" value={form.whatsapp} onChange={e => update({ whatsapp: e.target.value.replace(/\s/g, "") })} /></label><label>Horaires<input maxLength={250} placeholder="Ex. : lun – sam, 8 h – 18 h" value={form.hours} onChange={e => update({ hours: e.target.value })} /></label></div>
          <label>Adresse du dépôt<input required minLength={2} maxLength={400} value={form.address} onChange={e => update({ address: e.target.value })} /></label>
          <label>Présentation du pressing<textarea maxLength={1000} value={form.description} placeholder="Quelques mots sur vos services et votre accueil…" onChange={e => update({ description: e.target.value })} /></label>
          <BrandEditor value={brand} onChange={branding => update({ branding })} />
          <details><summary>Lien et devise</summary><div className="sf-stack"><label>Identifiant du lien<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={70} disabled={!!data.shop} value={form.slug} onChange={e => update({ slug: e.target.value })} /></label><small>{link}</small><label>Devise des tarifs<select disabled={!!data.shop || !!data.currency} value={form.currency} onChange={e => update({ currency: e.target.value as ShopInput["currency"] })}>{["XAF", "XOF", "EUR", "USD", "CDF", "NGN", "GHS", "KES", "MAD", "DZD", "TND", "AOA", "MZN", "ZAR", "RWF", "UGX", "TZS", "GNF", "MGA"].map(c => <option key={c}>{c}</option>)}</select></label><small>Le lien et la devise sont figés après le premier enregistrement. La devise est commune à la caisse et aux reçus de votre organisation ; aucun taux de change n’est appliqué.</small></div></details>
        </section>}
        {step === 1 && <section className="sf-card sf-stack"><div><span className="sf-eyebrow">Étape 2 sur 3</span><h2 ref={title} tabIndex={-1}>Vos services et vos tarifs</h2><p className="sf-muted">Vos services actifs sont proposés automatiquement à la création. Décochez ceux que vous souhaitez garder au comptoir.</p></div>
          {!available.length && <Message>Créez d’abord les services de cette agence dans Xpress Pro.</Message>}
          {available.map(s => { const offer = form.services.find(v => v.serviceId === s.id); return <div className="sf-service sf-stack" key={s.id}>
            <label className="sf-check"><input type="checkbox" checked={!!offer} disabled={!offer && form.services.length >= 100} onChange={e => { const images = { ...brand.serviceImages }; if (!e.target.checked) delete images[s.id]; update({ services: e.target.checked ? [...form.services, { serviceId: s.id, mode: s.unit as "kg" | "piece" }] : form.services.filter(v => v.serviceId !== s.id), branding: { ...brand, serviceImages: images } }); }} /><span><strong>{s.name}</strong><small>{money(s.price, form.currency)} / {s.unit === "kg" ? "kg" : "pièce"}</small></span></label>
            {offer && <details><summary>Photo et options de {s.name}</summary><div className="sf-stack">
              {s.unit === "piece" && <label>Facturation de {s.name}<select value={offer.mode} onChange={e => update({ services: form.services.map(v => v.serviceId === s.id ? { ...v, mode: e.target.value as "piece" | "quote" } : v) })}><option value="piece">Au tarif par pièce</option><option value="quote">Sur devis après examen</option></select></label>}
              <ImagePicker label={`Photo de ${s.name}`} kind="service" value={brand.serviceImages[s.id] ?? ""} onChange={image => { const images = { ...brand.serviceImages }; if (image) images[s.id] = image; else delete images[s.id]; update({ branding: { ...brand, serviceImages: images } }); }} />
            </div></details>}
          </div>; })}
          <small>Les prix se modifient dans Services. Vous pouvez illustrer jusqu’à 12 services.</small>
          {hasKg && <div className="sf-stack"><h3>Estimation au kilo</h3><p className="sf-muted">Le client choisit Enfant, Adolescent ou Adulte. Le prix reste estimatif jusqu’à votre vérification au dépôt.</p><details><summary>Consulter ou ajuster les poids de référence</summary><Message>Ces valeurs sont des hypothèses de départ, pas des moyennes garanties. Ajustez-les avec vos pesées. Une case vide impose une pesée.</Message><div className="sf-table-wrap"><table><thead><tr><th>Vêtement</th>{Object.values(SIZE_LABELS).map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>{form.weights.map((w, i) => <tr key={w.garment}><td>{GARMENT_LABELS[w.garment]}</td>{(["child", "teen", "adult"] as const).map(group => <td key={group}><input aria-label={`${GARMENT_LABELS[w.garment]} ${SIZE_LABELS[group]} en grammes`} type="number" min="1" max="50000" value={w[group] ?? ""} placeholder="À peser" onChange={e => update({ weightsAcknowledged: false, weights: form.weights.map((row, index) => index === i ? { ...row, [group]: e.target.value === "" ? null : Number(e.target.value) } : row) })} /></td>)}</tr>)}</tbody></table></div></details><label className="sf-check"><input type="checkbox" checked={form.weightsAcknowledged} onChange={e => update({ weightsAcknowledged: e.target.checked })} />J’ai vérifié les poids de référence. Je confirmerai le devis au dépôt.</label></div>}
        </section>}
        {step === 2 && <section className="sf-card sf-stack"><div><span className="sf-eyebrow">Étape 3 sur 3</span><h2 ref={title} tabIndex={-1}>Votre boutique est prête à être partagée</h2></div>
          <p><strong>{form.name}</strong> · {selected.length} service{selected.length > 1 ? "s" : ""} · {form.currency}</p>
          {!data.shop && <Message>Premier enregistrement : le lien « {form.slug} » et la devise {form.currency} seront fixés. Vérifiez qu’ils correspondent à vos tarifs et à votre organisation.</Message>}
          {hasKg && !form.weightsAcknowledged && <Message>Validez les poids de référence à l’étape 2 avant d’ouvrir une boutique avec facturation au kilo.</Message>}
          <label className="sf-check"><input type="checkbox" checked={form.published} onChange={e => update({ published: e.target.checked })} />Ouvrir la boutique aux demandes</label>
          <small>Décochez pour conserver une boutique fermée. Les demandes déjà reçues restent accessibles.</small>
          <button type="submit" disabled={action.busy}>{action.busy ? "Enregistrement…" : form.published ? "Enregistrer et ouvrir la boutique" : "Enregistrer la boutique fermée"}</button>
          {saved && <Message>Configuration enregistrée.</Message>}
          {data.shop?.published && <div className="sf-stack"><a className="sf-link-box" href={link} target="_blank" rel="noopener noreferrer">Voir ma boutique</a><small>{link}</small><div className="sf-row">{qr && <img className="sf-qr" src={qr} alt="QR code de la boutique" />}<button type="button" className="sf-secondary" onClick={() => action.run(async () => { await navigator.clipboard.writeText(link); setCopied(true); })}>{copied ? "Lien copié" : "Copier le lien à partager"}</button></div><small>Collez ce lien dans une conversation, votre statut ou votre profil WhatsApp Business.</small></div>}
        </section>}
        {step === 2 && data.shop && <section className="sf-card sf-stack" aria-label="Commande dans WhatsApp">
          <h3>Commande dans WhatsApp · option</h3>
          <p className="sf-muted">Proposez un formulaire de commande directement dans une conversation WhatsApp.</p>
          <a className="sf-button" href="/boutique/connexion-whatsapp">Connecter mon WhatsApp</a>
        </section>}
        {action.error && <Message error>{action.error}</Message>}
        <div className="sf-wizard-actions">{step > 0 && <button type="button" className="sf-secondary" onClick={() => navigate(step - 1)}>Retour</button>}{step < 2 && <button type="submit">Continuer</button>}</div>
      </fieldset>
    </form>
    <aside className="sf-live-preview"><span className="sf-eyebrow">Aperçu sur téléphone</span><div className="sf-preview-phone sf" style={brandStyle(brand)}><ShopHeader name={form.name} description={form.description} address={form.address} hours={form.hours} branding={brand} compact /><div className="sf-preview-services"><h3>Nos services</h3>{selected.map(s => <div key={s.id} className="sf-service-option">{brand.serviceImages[s.id] && <img src={brand.serviceImages[s.id]} alt="" />}<span><strong>{s.name}</strong><small>{form.services.find(v => v.serviceId === s.id)?.mode === "quote" ? "Sur devis" : `${money(s.price, form.currency)} / ${s.unit === "kg" ? "kg" : "pièce"}`}</small></span></div>)}<div className="sf-preview-cta">Choisir mes vêtements →</div><footer className="sf-footer">Propulsé par Xpress Pro</footer></div></div></aside>
  </div>;
}
