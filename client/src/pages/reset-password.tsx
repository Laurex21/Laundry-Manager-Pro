import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, LockKeyhole, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const params = useParams<{ token?: string }>();
  const [, setLocation] = useLocation();
  const searchAccount = new URLSearchParams(window.location.search).get("account");
  const [accountType, setAccountType] = useState(searchAccount === "staff" ? "staff" : "owner");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [completedAccountType, setCompletedAccountType] = useState<"owner" | "staff" | null>(null);

  const token = params.token;

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, accountType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: t("error"), description: data.message || t("network_error_retry"), variant: "destructive" });
        return;
      }
      setSent(true);
    } catch {
      toast({ title: t("error"), description: t("network_error_retry"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t("error"), description: t("passwords_do_not_match", "Les mots de passe ne correspondent pas."), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: t("error"), description: data.message || t("network_error_retry"), variant: "destructive" });
        return;
      }
      setCompletedAccountType(data.accountType === "staff" ? "staff" : "owner");
    } catch {
      toast({ title: t("error"), description: t("network_error_retry"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const loginPath = completedAccountType === "staff" || accountType === "staff" ? "/staff-login" : "/auth";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/20">
            {sent || completedAccountType ? <CheckCircle2 className="w-6 h-6 text-primary-foreground" /> : <LockKeyhole className="w-6 h-6 text-primary-foreground" />}
          </div>
          <CardTitle>{token ? t("reset_password", "Réinitialiser le mot de passe") : t("forgot_password", "Mot de passe oublié")}</CardTitle>
          <CardDescription>
            {token
              ? t("reset_password_subtitle", "Créez un nouveau mot de passe pour votre compte XPRESSPRO.")
              : t("forgot_password_subtitle", "Entrez votre email ou numéro de téléphone pour recevoir un lien sécurisé.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("reset_link_sent", "Si un compte existe, un lien de réinitialisation a été envoyé. Le lien expire dans 30 minutes.")}
              </p>
              <Button className="w-full" onClick={() => setLocation(loginPath)} data-testid="button-back-to-login">
                <Shirt className="w-4 h-4 mr-2" />
                {t("back_to_login", "Retour à la connexion")}
              </Button>
            </div>
          ) : completedAccountType ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("password_reset_complete", "Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.")}
              </p>
              <Button className="w-full" onClick={() => setLocation(loginPath)} data-testid="button-login-after-reset">
                {completedAccountType === "staff" ? t("staff_login", "Connexion employé") : t("sign_in")}
              </Button>
            </div>
          ) : token ? (
            <form onSubmit={confirmReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("new_password", "Nouveau mot de passe")}</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("confirm_password")}</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  data-testid="input-confirm-new-password"
                />
              </div>
              <Button className="w-full" type="submit" disabled={submitting} data-testid="button-confirm-password-reset">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("please_wait")}</> : t("save_new_password", "Enregistrer le nouveau mot de passe")}
              </Button>
            </form>
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("account_type", "Type de compte")}</label>
                <Select value={accountType} onValueChange={(value) => setAccountType(value === "staff" ? "staff" : "owner")}>
                  <SelectTrigger data-testid="select-reset-account-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">{t("owner_account", "Compte propriétaire")}</SelectItem>
                    <SelectItem value="staff">{t("staff_account", "Compte employé")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("email_or_phone")}</label>
                <Input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  autoComplete="username"
                  data-testid="input-reset-identifier"
                />
              </div>
              <Button className="w-full" type="submit" disabled={submitting} data-testid="button-request-password-reset">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("please_wait")}</> : t("send_reset_link", "Envoyer le lien sécurisé")}
              </Button>
              <Button variant="ghost" type="button" className="w-full" onClick={() => setLocation(loginPath)} data-testid="button-cancel-password-reset">
                {t("cancel")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
