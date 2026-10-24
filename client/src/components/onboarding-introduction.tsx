import { useTranslation } from "react-i18next";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function OnboardingIntroduction({ mode, onStart, onSkip, onClose }: {
  mode: "welcome" | "reminder" | null; onStart: () => void; onSkip: () => void; onClose: () => void;
}) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const pt = i18n.language.startsWith("pt");
  const text = (f: string, e: string, p: string) => fr ? f : pt ? p : e;
  const welcome = mode === "welcome";
  return <Dialog open={mode !== null} onOpenChange={open => { if (!open) { if (welcome) onSkip(); else onClose(); } }}>
    <DialogContent className="max-w-md" data-testid={welcome ? "onboarding-welcome" : "onboarding-help-reminder"}>
      <DialogHeader>
        <DialogTitle>{welcome ? text("Bienvenue sur XpressPro !", "Welcome to XpressPro!", "Bem-vindo ao XpressPro!") : text("Le guide reste à votre disposition", "Your guide is always available", "O guia está sempre disponível")}</DialogTitle>
        <DialogDescription>{welcome
          ? text("Gérez votre pressing, vos clients, vos commandes et vos encaissements au même endroit. Ce guide vous accompagne dans vos premiers pas : configurer votre entreprise, préparer vos services, puis suivre une commande jusqu’au reçu. Vous pouvez commencer maintenant ou découvrir l’application à votre rythme.", "Manage your laundry, customers, orders and collections in one place. This guide walks you through setting up your business, preparing services and following an order through to its receipt. Start now, or explore the app at your own pace.", "Gira a sua lavandaria, clientes, pedidos e recebimentos num só lugar. Este guia acompanha a configuração da empresa, dos serviços e de um pedido até ao recibo. Comece agora ou explore a aplicação ao seu ritmo.")
          : text("Vous pouvez reprendre le tutoriel quand vous le souhaitez, depuis n’importe quelle page.", "You can resume the tutorial whenever you like, from any page.", "Pode retomar o tutorial quando quiser, a partir de qualquer página.")}</DialogDescription>
      </DialogHeader>
      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm" data-testid="onboarding-help-location">
        <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p>{text("En haut à droite, ouvrez l’icône ? Aide, puis « Guide de prise en main ». Cet accès est aussi disponible sur mobile.", "At the top right, open the ? Help menu, then choose “Getting started guide”. You can also find it there on mobile.", "No canto superior direito, abra o menu ? Ajuda e escolha « Getting started guide ». Também está disponível no telemóvel.")}</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={welcome ? onSkip : onClose} data-testid="onboarding-intro-dismiss">{welcome ? text("Découvrir sans le guide", "Explore without the guide", "Explorar sem o guia") : text("Compris", "Got it", "Entendido")}</Button>
        {welcome && <Button onClick={onStart} data-testid="onboarding-intro-start">{text("Commencer le guide", "Start the guide", "Iniciar o guia")}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
