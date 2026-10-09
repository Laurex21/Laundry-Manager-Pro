import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

type Notice = { kind: "trial_reminder" | "trial_expired"; remainingMs: number };

export function SaasTrialNoticeV4Banner() {
  const { isOwner } = useAuth();
  const { i18n } = useTranslation();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    fetch("/api/saas-v4/trial-notice/claim", { method: "POST", credentials: "include" })
      .then((response) => response.ok ? response.json() as Promise<{ notice: Notice | null }> : null)
      .then((data) => { if (!cancelled) setNotice(data?.notice ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOwner]);

  if (!notice) return null;
  const fr = i18n.language.startsWith("fr");
  const pt = i18n.language.startsWith("pt");
  const expired = notice.kind === "trial_expired";
  const days = Math.ceil(notice.remainingMs / 86_400_000);
  const hours = Math.ceil(notice.remainingMs / 3_600_000);
  const remaining = notice.remainingMs > 86_400_000
    ? `${days} ${fr ? "jours" : pt ? "dias" : "days"}`
    : `${hours} ${fr ? "heures" : pt ? "horas" : "hours"}`;

  return <div role="status" className="mx-auto w-full max-w-[1440px] border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:px-6 lg:px-8">
    <strong>{expired
      ? (fr ? "Votre essai Pro est terminé." : pt ? "O teste Pro terminou." : "Your Pro trial has ended.")
      : (fr ? `Votre essai Pro se termine dans ${remaining}.` : pt ? `O teste Pro termina em ${remaining}.` : `Your Pro trial ends in ${remaining}.`)}</strong>{" "}
    <span>{expired
      ? (fr ? "Vos données sont conservées sur Starter." : pt ? "Os seus dados permanecem no Starter." : "Your data is preserved on Starter.")
      : (fr ? "Choisissez une formule pour conserver Pro." : pt ? "Escolha um plano para manter Pro." : "Choose a plan to keep Pro.")}</span>{" "}
    <Link href="/subscriptions" className="font-semibold underline underline-offset-2">
      {fr ? "Voir les formules" : pt ? "Ver planos" : "View plans"}
    </Link>
  </div>;
}
