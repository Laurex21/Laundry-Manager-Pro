import { useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const LEGAL_META = {
  terms: {
    title: "XpressPro Terms of Service",
    version: "1.0 Enterprise Edition",
    effective: "30 June 2026",
    intro:
      "These Terms govern access to and use of the XpressPro Platform operated by GENERAL ADVANCE SERVICES SARL.",
    sections: [
      "Account creation, subscription plans, billing, auto-renewal, refunds, failed payments, chargebacks, and termination.",
      "Acceptable use, account security, multi-tenant SaaS access, site roles, integrations, and third-party services.",
      "Customer data ownership, data export, AI features, platform metrics, intellectual property, and confidentiality.",
      "Service availability, backups, suspension, disclaimers, limitation of liability, indemnification, Cameroon governing law, and dispute resolution.",
    ],
  },
  privacy: {
    title: "XpressPro Privacy Policy",
    version: "1.0",
    effective: "30 June 2026",
    intro:
      "This Privacy Policy explains how XpressPro collects, uses, stores, shares, protects, transfers, retains, and deletes Personal Information.",
    sections: [
      "XpressPro recognizes Law No. 2024/017 of 23 December 2024 relating to the protection of personal data in Cameroon.",
      "The Platform may process account information, employee information, customer information, garment records, payments, audit logs, analytics, device information, and support records.",
      "Processing purposes include service delivery, authentication, billing, customer support, fraud detection, security, analytics, product improvement, and legal compliance.",
      "Users may have rights of access, correction, deletion, restriction, objection, portability, consent withdrawal, and complaint depending on Applicable Law.",
    ],
  },
  cookies: {
    title: "XpressPro Cookie Policy",
    version: "1.0",
    effective: "30 June 2026",
    intro:
      "This Cookie Policy explains how XpressPro uses cookies, browser storage, local storage, SDKs, pixels, web beacons, session identifiers, and similar technologies.",
    sections: [
      "Essential cookies support login, authentication, account security, session management, fraud prevention, and core Platform functionality.",
      "Security, preference, performance, analytics, and functionality cookies may support safer access, saved settings, error diagnosis, and product improvement.",
      "Marketing cookies may be used in the future only where permitted by Applicable Law and, where required, after appropriate consent.",
      "Users may manage cookies through browser settings or Platform controls where available, but blocking essential cookies may prevent secure Platform access.",
    ],
  },
} as const;

type LegalType = keyof typeof LEGAL_META;

const FULL_LEGAL_DOCUMENT_URL = "/legal/XPRESSPRO_TERMS_OF_SERVICE_UPDATED_LEGAL_COOKIE_2026-06-30.docx";

function legalTypeFromPath(path: string): LegalType {
  if (path.includes("privacy")) return "privacy";
  if (path.includes("cookies")) return "cookies";
  return "terms";
}

export default function LegalPage() {
  const [location, setLocation] = useLocation();
  const legalType = legalTypeFromPath(location);
  const content = LEGAL_META[legalType];
  const relatedLinks = useMemo(() => [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/cookies", label: "Cookies" },
  ], []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          className="w-fit gap-2"
          onClick={() => setLocation("/auth")}
          data-testid="button-legal-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to XpressPro
        </Button>

        <section className="space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {legalType === "privacy" ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Legal document</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{content.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Version {content.version} · Effective {content.effective}
            </p>
          </div>
          <p className="text-base leading-7 text-muted-foreground">{content.intro}</p>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Key provisions</h2>
          <ul className="mt-4 space-y-3">
            {content.sections.map((section) => (
              <li key={section} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>{section}</span>
              </li>
            ))}
          </ul>
        </section>

        {legalType !== "terms" && (
          <section className="rounded-lg border bg-card p-5 text-sm leading-6 text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">Mesure TikTok — 27 octobre 2026</h2>
            <p className="mt-3">Sur les pages publiques, après votre accord, le pixel TikTok mesure les visites, clics de contact et inscriptions réussies. TikTok reçoit les informations techniques de connexion, notamment l’adresse IP, ainsi que la catégorie de page, l’action et les codes de campagne autorisés. Aucune donnée saisie dans les formulaires, donnée client, commande, adresse e-mail ou numéro de téléphone n’est transmis par notre intégration. Les pages privées sont exclues.</p>
            <p className="mt-3">Le site conserve aussi pendant 90 jours un journal de mesure avec un identifiant aléatoire de session, la source reconnue, les codes de campagne autorisés, la catégorie de page et l’action. Ce journal ne contient ni adresse IP, ni adresse e-mail, ni numéro de téléphone, ni identifiant de compte ou données clients. Il permet de distinguer les visites, clics WhatsApp et inscriptions réussies par source ; il ne mesure pas les conversations WhatsApp. La session expire après 30 minutes d’inactivité et le retrait du consentement arrête les nouveaux envois. La correspondance avancée automatique, la collecte enrichie et les cookies propriétaires TikTok sont désactivés. Votre choix est conservé dans le stockage local du navigateur ; les codes de campagne sont conservés dans la session de l’onglet après accord. Vous pouvez refuser ou retirer votre accord via « Choix de mesure » sur les pages publiques, sans bloquer l’accès au site. Le retrait efface les codes de campagne mémorisés et arrête les nouveaux envois.</p>
            <a className="mt-3 inline-block underline" href="https://www.tiktok.com/legal/page/row/privacy-policy/en" target="_blank" rel="noopener noreferrer">Politique de confidentialité TikTok</a>
          </section>
        )}

        <section className="rounded-lg border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
          The full legal package is the XpressPro Terms of Service document approved for this version,
          including the Privacy Policy and standalone Cookie Policy. Acceptance records are stored with
          the document versions and document hash for auditability.
          <div className="mt-4">
            <a
              href={FULL_LEGAL_DOCUMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              data-testid="link-full-legal-document"
            >
              Download full legal document
            </a>
          </div>
        </section>

        <nav className="flex flex-wrap gap-2" aria-label="Related legal documents">
          {relatedLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
