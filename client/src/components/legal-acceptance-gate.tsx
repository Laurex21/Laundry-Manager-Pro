import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

async function acceptLegalDocuments() {
  const res = await fetch("/api/legal/accept", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to record legal acceptance");
  }
  return res.json();
}

export function LegalAcceptanceGate() {
  const queryClient = useQueryClient();
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const legalAcceptance = user?.legalAcceptance;
  const isRequired = legalAcceptance?.required === true;

  const acceptMutation = useMutation({
    mutationFn: acceptLegalDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: t("legal_acceptance_toast_success_title"),
        description: t("legal_acceptance_toast_success_desc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("legal_acceptance_toast_error_title"),
        description: error.message || t("legal_acceptance_toast_error_desc"),
        variant: "destructive",
      });
    },
  });

  if (!isRequired || !legalAcceptance) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-h-[92vh] max-w-xl overflow-hidden p-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        data-testid="legal-acceptance-modal"
      >
        <div className="border-b px-6 py-5">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>{t("legal_acceptance_modal_title")}</DialogTitle>
            <DialogDescription>
              {t("legal_acceptance_modal_desc")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[48vh] overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-start gap-2 text-sm font-semibold">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t("legal_acceptance_required_title")}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("legal_acceptance_required_body")}
              </p>
            </div>

            <div className="space-y-2">
              <a
                href={legalAcceptance.current.fullDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                data-testid="link-legal-full-document"
              >
                <span className="font-semibold text-primary">{t("legal_acceptance_download_full")}</span>
                <span className="text-xs text-muted-foreground">{t("legal_acceptance_docx")}</span>
              </a>
              {legalAcceptance.current.documents.map((document) => (
                <a
                  key={document.type}
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  data-testid={`link-legal-${document.type}`}
                >
                  <span className="font-medium">{t(`legal_document_${document.type}`, document.title)}</span>
                  <span className="text-xs text-muted-foreground">{document.version}</span>
                </a>
              ))}
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{t("legal_acceptance_record_title")}</span>
              </div>
              <p className="leading-relaxed">
                {t("legal_acceptance_record_body")}
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="legal-confirmation"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                data-testid="checkbox-legal-confirmation"
              />
              <Label htmlFor="legal-confirmation" className="text-sm leading-relaxed">
                {t("legal_acceptance_confirm_statement")}
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => logout()}
            disabled={isLoggingOut || acceptMutation.isPending}
            data-testid="button-decline-legal"
          >
            {t("legal_acceptance_decline_sign_out")}
          </Button>
          <Button
            type="button"
            disabled={!confirmed || acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            data-testid="button-accept-legal"
          >
            {acceptMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("legal_acceptance_recording")}
              </span>
            ) : (
              t("legal_acceptance_accept_continue")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
