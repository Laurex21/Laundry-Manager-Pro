import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, X } from "lucide-react";

type Step = { path: string; target: string; title: string; description: string; mobilePath: string; desktopPath: string; destination: string };
const STEPS_FR: Step[] = [
  { path: "/settings", target: '[data-testid="button-save-identity"]', title: "Configurez votre pressing", description: "Vérifiez le nom et les coordonnées de votre entreprise, puis enregistrez-les.", mobilePath: "Plus → Réglages", desktopPath: "Administration → Réglages", destination: "Réglages" },
  { path: "/customers", target: '[data-testid="onboarding-add-customer"]', title: "Ajoutez un client", description: "Créez une fiche client pour retrouver facilement ses commandes.", mobilePath: "Clients (barre du bas)", desktopPath: "Opérations → Clients", destination: "Clients" },
  { path: "/orders", target: '[data-testid="onboarding-new-order"]', title: "Créez votre première commande", description: "Dans Commandes, cliquez sur Nouvelle commande puis renseignez les articles, le prix et la date de retrait.", mobilePath: "Commandes (barre du bas)", desktopPath: "Opérations → Commandes", destination: "Commandes" },
  { path: "/orders", target: '[data-testid="onboarding-order-status"]', title: "Suivez la production", description: "Retrouvez vos commandes et mettez à jour leur état à chaque étape.", mobilePath: "Commandes (barre du bas)", desktopPath: "Opérations → Commandes", destination: "Commandes" },
  { path: "/payments", target: '[data-testid="payment-ledger-redesign"]', title: "Enregistrez un paiement", description: "Consultez les paiements et soldes pour garder vos comptes à jour.", mobilePath: "Paiements (barre du bas)", desktopPath: "Opérations → Paiements", destination: "Paiements" },
];
const STEPS_EN: Step[] = [
  { path: "/settings", target: '[data-testid="button-save-identity"]', title: "Set up your laundry", description: "Check your business name and contact details, then save them.", mobilePath: "More → Settings", desktopPath: "Administration → Settings", destination: "Settings" },
  { path: "/customers", target: '[data-testid="onboarding-add-customer"]', title: "Add a customer", description: "Create a customer profile to find their orders easily.", mobilePath: "Customers (bottom bar)", desktopPath: "Operations → Customers", destination: "Customers" },
  { path: "/orders", target: '[data-testid="onboarding-new-order"]', title: "Create your first order", description: "In Orders, tap New Order, then enter the items, price, and pickup date.", mobilePath: "Orders (bottom bar)", desktopPath: "Operations → Orders", destination: "Orders" },
  { path: "/orders", target: '[data-testid="onboarding-order-status"]', title: "Track production", description: "Find your orders and update their status at each stage.", mobilePath: "Orders (bottom bar)", desktopPath: "Operations → Orders", destination: "Orders" },
  { path: "/payments", target: '[data-testid="payment-ledger-redesign"]', title: "Record a payment", description: "Review payments and balances to keep your accounts up to date.", mobilePath: "Payments (bottom bar)", desktopPath: "Operations → Payments", destination: "Payments" },
];
const guideKey = (userId: string) => `xpresspro-getting-started-v1:${userId}`;

type Props = { userId: string; restartToken: number; onClose: () => void };
export function GettingStartedGuide({ userId, restartToken, onClose }: Props) {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const steps = fr ? STEPS_FR : STEPS_EN;
  const [stepIndex, setStepIndex] = useState(() => {
    const value = Number(window.localStorage.getItem(guideKey(userId)) ?? 0);
    return Number.isInteger(value) && value >= 0 && value < steps.length ? value : 0;
  });
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = steps[stepIndex];

  useEffect(() => {
    if (!restartToken) return;
    setStepIndex(0);
    window.localStorage.setItem(guideKey(userId), "0");
  }, [restartToken, userId]);

  useEffect(() => {
    const routeNav = current.path === "/" ? "dashboard" : current.path.slice(1);
    const visible = (selector: string) => Array.from(document.querySelectorAll(selector)).find((node) => node.getClientRects().length > 0);
    const findTarget = () => {
      if (location === current.path) return visible(current.target);
      const desktopNav = `[data-testid="nav-${routeNav}"]`;
      const mobileNav = current.path === "/settings"
        ? '[data-testid="nav-settings"], [data-testid="bottom-nav-more"]'
        : `[data-testid="bottom-nav-${routeNav}"]`;
      return window.matchMedia("(min-width: 1024px)").matches
        ? visible(desktopNav)
        : visible(mobileNav);
    };
    const update = () => setRect(findTarget()?.getBoundingClientRect() ?? null);
    const timer = window.setTimeout(() => {
      findTarget()?.scrollIntoView({ block: "center", behavior: "smooth" });
      update();
    }, 350);
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [location, current.path, current.target]);

  const finish = () => {
    window.localStorage.setItem(guideKey(userId), "done");
    onClose();
  };
  const next = () => {
    if (stepIndex === steps.length - 1) { finish(); return; }
    const value = stepIndex + 1;
    window.localStorage.setItem(guideKey(userId), String(value));
    setStepIndex(value);
  };
  return <>
    {rect && rect.width > 0 && rect.height > 0 && <div className="pointer-events-none fixed z-[49] rounded-xl border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(8,29,66,0.22),0_0_0_8px_rgba(23,105,224,0.15)]" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} aria-hidden="true" />}
    <aside className="fixed left-3 right-3 top-[calc(4rem+env(safe-area-inset-top))] z-[50] max-h-[42dvh] max-w-sm overflow-y-auto rounded-2xl border border-blue-200 bg-white p-4 text-[#0D1B4B] shadow-[0_18px_55px_rgba(13,27,75,.24)] sm:p-5 lg:bottom-6 lg:left-auto lg:right-6 lg:top-auto lg:max-h-[70vh]" aria-label={fr ? "Guide de prise en main" : "Getting started guide"} data-testid="getting-started-guide">
      <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold uppercase tracking-widest text-blue-600">{fr ? "Prise en main" : "Getting started"} · {stepIndex + 1}/{steps.length}</p><button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label={fr ? "Fermer le guide" : "Close guide"}><X className="h-4 w-4" /></button></div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">{steps.map((_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-blue-600" : "bg-slate-200"}`} />)}</div>
      <h2 className="mt-3 text-lg font-bold sm:mt-5">{current.title}</h2><p className="mt-1 text-sm leading-5 text-slate-600 sm:mt-2 sm:leading-6">{current.description}</p>
      <p className="mt-3 text-xs font-semibold text-blue-700">{fr ? "Cliquez sur l’élément encadré :" : "Tap the highlighted item:"} <span className="lg:hidden">{current.mobilePath}</span><span className="hidden lg:inline">{current.desktopPath}</span></p>
      {location !== current.path && <button type="button" onClick={() => navigate(current.path)} className="mt-3 flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">{fr ? `Ouvrir ${current.destination}` : `Open ${current.destination}`}<ChevronRight className="h-4 w-4" /></button>}
      <div className="mt-3 flex items-center justify-between gap-3 sm:mt-5"><button type="button" onClick={finish} className="text-xs font-medium text-slate-500 underline underline-offset-2">{fr ? "Passer le guide" : "Skip guide"}</button><button type="button" onClick={next} className="flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Check className="h-4 w-4" />{stepIndex === steps.length - 1 ? (fr ? "Terminer" : "Finish") : (fr ? "J’ai terminé · suite" : "Done · next")}</button></div>
    </aside>
  </>;
}
