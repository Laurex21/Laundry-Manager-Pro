import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2, Shirt, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function StaffLogin() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) setLocation("/dashboard");
  }, [user, isLoading, setLocation]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credential, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: t("error"), description: data.message || t("auth_failed"), variant: "destructive" });
        return;
      }
      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/dashboard");
    } catch {
      toast({ title: t("error"), description: t("network_error_retry"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/20">
            <UserCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Staff login</CardTitle>
          <CardDescription>Access your assigned XPRESSPRO site without creating a subscriber account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("email_or_phone")}</label>
              <Input
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                required
                autoComplete="username"
                data-testid="input-staff-login-credential"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("password")}</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                data-testid="input-staff-login-password"
              />
            </div>
            <div className="text-right -mt-2">
              <button
                type="button"
                className="text-xs text-primary font-semibold hover:underline"
                onClick={() => setLocation("/reset-password?account=staff")}
                data-testid="button-forgot-staff-password"
              >
                {t("forgot_password", "Mot de passe oublié ?")}
              </button>
            </div>
            <Button className="w-full" type="submit" disabled={submitting} data-testid="button-staff-login-submit">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("please_wait")}</> : "Log in as staff"}
            </Button>
            <Button variant="ghost" type="button" className="w-full" onClick={() => setLocation("/auth")} data-testid="button-owner-login-link">
              <Shirt className="w-4 h-4 mr-2" />
              Owner login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
