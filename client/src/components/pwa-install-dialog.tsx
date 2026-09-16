import { Download, MonitorDown, Share, Smartphone, SquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { usePwaInstall } from "@/hooks/use-pwa-install";

const COPY = {
  fr: { title: "Installer XpressPro", description: "Accédez à XpressPro depuis votre écran d’accueil ou votre bureau, comme une application.", install: "Installer maintenant", installed: "XpressPro est déjà installé sur cet appareil.", iosTitle: "Sur iPhone ou iPad", iosStep1: "Touchez le bouton Partager dans Safari.", iosStep2: "Choisissez Sur l’écran d’accueil, puis Ajouter.", computerTitle: "Sur ordinateur", computerText: "Dans Chrome ou Edge, ouvrez le menu du navigateur puis choisissez Installer XpressPro.", safe: "L’installation crée un raccourci sécurisé. Les données métier ne sont pas stockées hors ligne.", close: "Fermer" },
  pt: { title: "Instalar o XpressPro", description: "Acesse o XpressPro pela tela inicial ou área de trabalho, como um aplicativo.", install: "Instalar agora", installed: "O XpressPro já está instalado neste dispositivo.", iosTitle: "No iPhone ou iPad", iosStep1: "Toque no botão Compartilhar no Safari.", iosStep2: "Escolha Adicionar à Tela de Início e confirme.", computerTitle: "No computador", computerText: "No Chrome ou Edge, abra o menu do navegador e escolha Instalar XpressPro.", safe: "A instalação cria um atalho seguro. Os dados operacionais não são armazenados offline.", close: "Fechar" },
  en: { title: "Install XpressPro", description: "Open XpressPro from your home screen or desktop, just like an app.", install: "Install now", installed: "XpressPro is already installed on this device.", iosTitle: "On iPhone or iPad", iosStep1: "Tap the Share button in Safari.", iosStep2: "Choose Add to Home Screen, then confirm.", computerTitle: "On a computer", computerText: "In Chrome or Edge, open the browser menu and choose Install XpressPro.", safe: "Installation creates a secure shortcut. Business data is not stored offline.", close: "Close" },
};

type PwaInstaller = ReturnType<typeof usePwaInstall>;

export function PwaInstallDialog({ open, onOpenChange, installer }: { open: boolean; onOpenChange: (open: boolean) => void; installer: PwaInstaller }) {
  const { i18n } = useTranslation();
  const { canInstall, install, installed, isIosSafari } = installer;
  const copy = COPY[i18n.language.startsWith("fr") ? "fr" : i18n.language.startsWith("pt") ? "pt" : "en"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0" data-testid="pwa-install-dialog">
        <div className="bg-[#082D5B] px-6 py-6 text-white">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white"><img src="/xpresspro-mark.svg" alt="" className="h-9 w-9" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">XpressPro</p><DialogTitle className="text-xl text-white">{copy.title}</DialogTitle></div>
          </div>
          <DialogDescription className="text-sm leading-6 text-white/75">{copy.description}</DialogDescription>
        </div>
        <div className="space-y-4 px-6 pb-6 pt-5">
          {installed ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{copy.installed}</div>
            : canInstall ? <Button className="h-12 w-full gap-2 bg-[#6B5CFF] text-white hover:bg-[#5A4BE8]" onClick={async () => { if (await install()) onOpenChange(false); }} data-testid="button-install-pwa"><Download className="h-4 w-4" />{copy.install}</Button>
            : isIosSafari ? <div className="space-y-3 rounded-xl border border-[#082D5B]/12 bg-slate-50 p-4"><h3 className="flex items-center gap-2 font-semibold text-[#082D5B]"><Smartphone className="h-4 w-4" />{copy.iosTitle}</h3><p className="flex gap-3 text-sm text-slate-700"><Share className="mt-0.5 h-4 w-4 shrink-0 text-[#6B5CFF]" />{copy.iosStep1}</p><p className="flex gap-3 text-sm text-slate-700"><SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-[#6B5CFF]" />{copy.iosStep2}</p></div>
            : <div className="space-y-3 rounded-xl border border-[#082D5B]/12 bg-slate-50 p-4"><h3 className="flex items-center gap-2 font-semibold text-[#082D5B]"><MonitorDown className="h-4 w-4" />{copy.computerTitle}</h3><p className="text-sm leading-6 text-slate-700">{copy.computerText}</p></div>}
          <p className="text-xs leading-5 text-muted-foreground">{copy.safe}</p>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>{copy.close}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
