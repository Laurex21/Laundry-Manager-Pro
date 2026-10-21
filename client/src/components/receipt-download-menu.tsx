import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { ReceiptFormat } from "@/lib/receipt-export";

type Props = Omit<ComponentProps<typeof Button>, "onClick"> & { onDownload: (format: ReceiptFormat) => Promise<void> };
export function ReceiptDownloadMenu({ onDownload, children, disabled, ...props }: Props) {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const fr = i18n.language.startsWith("fr");
  async function download(format: ReceiptFormat) {
    if (busy) return;
    setBusy(true);
    try { await onDownload(format); }
    catch (error) {
      const tooLarge = error instanceof Error && error.message === "RECEIPT_TOO_LARGE";
      toast({ title: fr ? "Téléchargement impossible" : "Download failed", description: tooLarge
        ? (fr ? "Ce reçu est trop long pour un export HD sur cet appareil. Téléchargez le HTML." : "This receipt is too long for HD export on this device. Download the HTML.")
        : (fr ? "Le reçu n’a pas pu être généré. Réessayez ou choisissez le HTML." : "The receipt could not be generated. Try again or choose HTML."), variant: "destructive" });
    } finally { setBusy(false); }
  }
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button {...props} disabled={disabled || busy} aria-busy={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}{children}
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
      <DropdownMenuItem onSelect={() => void download("html")}>{fr ? "Télécharger en HTML" : "Download HTML"}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void download("pdf")}>{fr ? "Télécharger en PDF" : "Download PDF"}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void download("png")}>{fr ? "Télécharger en image HD (PNG)" : "Download HD image (PNG)"}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
