import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { BRAND_PRESETS, DEFAULT_BRANDING, accentForeground, type StorefrontBranding } from "@shared/storefront-branding";
import { Message } from "./storefront-ui";

export const brandStyle = (brand = DEFAULT_BRANDING): CSSProperties => ({
  "--sf-green": brand.accent, "--sf-button-text": accentForeground(brand.accent),
  "--sf-mark": accentForeground(brand.accent) === "#ffffff" ? brand.accent : "#183a34",
} as CSSProperties);

export function ShopHeader({ name, description, address, hours, branding = DEFAULT_BRANDING, compact = false }: {
  name: string; description: string; address: string; hours: string; branding?: StorefrontBranding; compact?: boolean;
}) {
  return <section className={`sf-shop-header sf-template-${branding.template} ${compact ? "sf-compact" : ""}`}>
    {branding.cover ? <img className="sf-cover" src={branding.cover} alt={`La boutique ${name}`} /> : <div className="sf-cover sf-cover-pattern" aria-hidden="true"><span>✦</span></div>}
    <div className="sf-shop-intro">
      {branding.logo ? <img className="sf-logo" src={branding.logo} alt={`Logo de ${name}`} /> : <div className="sf-logo sf-monogram" aria-hidden="true">{name.trim().slice(0, 1) || "P"}</div>}
      <div><span className="sf-eyebrow">Votre pressing de proximité</span><h1>{name || "Votre pressing"}</h1></div>
      {branding.welcome && <p className="sf-welcome">{branding.welcome}</p>}
      <details className="sf-shop-about"><summary>À propos · Horaires et adresse</summary>{description && <p className="sf-muted">{description}</p>}<div className="sf-shop-meta"><span>{address || "Adresse de votre pressing"}</span>{hours && <span>{hours}</span>}</div></details>
    </div>
  </section>;
}

async function prepareImage(file: File, kind: "logo" | "cover" | "service") {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) throw new Error("Choisissez une image JPG, PNG ou WebP de moins de 8 Mo.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (img.naturalWidth * img.naturalHeight > 16_000_000) throw new Error("Choisissez une image de moins de 16 mégapixels.");
    const max = kind === "cover" ? 1200 : kind === "logo" ? 320 : 480;
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Impossible de préparer cette image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const limit = kind === "cover" ? 160_000 : kind === "logo" ? 48_000 : 55_000;
    for (const quality of [.8, .65, .5, .35]) { const result = canvas.toDataURL("image/webp", quality); if (result.length <= limit) return result; }
    throw new Error("Cette image reste trop lourde. Choisissez une photo plus simple ou plus petite.");
  } finally { URL.revokeObjectURL(url); }
}

export function ImagePicker({ label, value, onChange, kind }: { label: string; value: string; onChange: (value: string) => void; kind: "logo" | "cover" | "service" }) {
  const id = useId(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const onChangeRef = useRef(onChange), mounted = useRef(true); onChangeRef.current = onChange;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="sf-image-picker" aria-busy={busy}><label htmlFor={id}>{label}</label>
    {value && <img src={value} alt={label} className={`sf-image-thumb sf-image-${kind}`} />}
    <input id={id} aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
      const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (!file) return;
      setBusy(true); setError(""); try { const image = await prepareImage(file, kind); if (mounted.current) onChangeRef.current(image); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    }} />
    {value && <button className="sf-secondary" type="button" disabled={busy} onClick={() => onChange("")}>Retirer {label.toLowerCase()}</button>}
    {busy && <small>Préparation de l’image…</small>}{error && <Message error>{error}</Message>}
  </div>;
}

export function BrandEditor({ value, onChange }: { value: StorefrontBranding; onChange: (value: StorefrontBranding) => void }) {
  return <div className="sf-stack"><div><h3>Un style pour commencer</h3><div className="sf-presets">
    {BRAND_PRESETS.map(p => <button type="button" className="sf-secondary" aria-pressed={value.template === p.template} key={p.name} onClick={() => onChange({ ...value, template: p.template, accent: p.accent })}><span className="sf-swatch" style={{ background: p.accent }} />{p.name}</button>)}
  </div></div>
    <label>Couleur de la boutique<input type="color" value={value.accent} onChange={e => onChange({ ...value, accent: e.target.value })} /></label>
    <label>Message d’accueil<input maxLength={100} value={value.welcome} onChange={e => onChange({ ...value, welcome: e.target.value })} /></label>
    <ImagePicker label="Logo" value={value.logo} kind="logo" onChange={logo => onChange({ ...value, logo })} />
    <ImagePicker label="Photo de couverture" value={value.cover} kind="cover" onChange={cover => onChange({ ...value, cover })} />
    <small>Photos JPG, PNG ou WebP, optimisées pour le téléphone. Utilisez les images de votre pressing.</small>
  </div>;
}
