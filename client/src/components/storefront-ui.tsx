import { useRef, useState, type ReactNode } from "react";
import type { StorefrontQuote } from "@shared/storefront";
import "./storefront.css";

export async function storefrontApi<T = any>(url: string, body?: unknown, method?: string, secret?: string): Promise<T> {
  const response = await fetch(url, { method: method ?? (body ? "POST" : "GET"), credentials: "same-origin", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(secret ? { Authorization: `Bearer ${secret}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Le service est momentanément indisponible");
  return result;
}
export const money = (value: string | null, currency: string) => value == null ? "À confirmer" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 5 }).format(Number(value))} ${currency === "XAF" || currency === "XOF" ? "FCFA" : currency}`;
export const whatsappHref = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
export function useStorefrontAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  const run = async (fn: () => Promise<void>) => { if (locked.current) return; locked.current = true; setBusy(true); setError(""); try { await fn(); } catch (e: any) { setError(e.message); } finally { locked.current = false; setBusy(false); } };
  return { busy, error, run, setError };
}
export function Message({ children, error = false }: { children: ReactNode; error?: boolean }) { return <p className={`sf-notice ${error ? "sf-error" : ""}`} role={error ? "alert" : "status"}>{children}</p>; }
export function QuoteSummary({ quote }: { quote: StorefrontQuote }) {
  return <section className="sf-quote" aria-label="Détail du devis">
    <span className="sf-eyebrow">{quote.basis === "estimate" ? "Estimation" : quote.basis === "measured" ? "Devis après pesée" : "Forfait au poids conventionnel"}</span>
    {quote.lots.map(lot => <div className="sf-quote-line" key={lot.serviceId}><div><strong>{lot.name}</strong><small>{lot.quantity == null ? "Poids à déterminer" : `${lot.quantity} ${lot.mode === "kg" ? "kg" : "pièce(s)"}`} · {lot.rate == null ? "Sur devis" : `${money(lot.rate, quote.currency)} / ${lot.mode === "kg" ? "kg" : "pièce"}`}</small>{lot.adjustment !== "0" && <small>Minimum de facturation : +{money(lot.adjustment, quote.currency)}</small>}</div><strong>{money(lot.total, quote.currency)}</strong></div>)}
    <div className="sf-total"><span>{quote.total == null ? "Sous-total connu" : "Total"}</span><strong>{money(quote.total ?? quote.knownTotal, quote.currency)}</strong></div>
    {quote.total == null && <p>Le total sera établi après pesée ou examen des articles à chiffrer.</p>}
    {quote.basis === "estimate" && <p>Estimation sous réserve de validation au pressing. Le poids réel dépend de la taille, du tissu et du modèle.</p>}
    {quote.basis === "conventional" && <p>Forfait calculé avec le barème de la boutique. Ce poids n’est pas une pesée réelle.</p>}
  </section>;
}
