import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shirt, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
];

// ── Auth Form ──────────────────────────────────────────────────────────────────

function AuthForm({ tab, setTab }: { tab: "login" | "register"; setTab: (t: "login" | "register") => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "register" && !acceptedLegal) {
      toast({
        title: t("error"),
        description: "You must accept the Terms of Service, Privacy Policy, and Cookie Policy to create an account.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        tab === "login"
          ? { email, password }
          : { email, password, firstName, lastName, phone, businessName, acceptedLegal };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("error"), description: data.message || t("auth_failed"), variant: "destructive" });
        return;
      }

      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/");
    } catch {
      toast({ title: t("error"), description: t("network_error_retry"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Tab switcher */}
      <div className="flex bg-slate-100 dark:bg-muted rounded-lg p-1 gap-1">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
            tab === "login"
              ? "bg-white dark:bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("login")}
          data-testid="tab-login"
        >
          {t("sign_in")}
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
            tab === "register"
              ? "bg-white dark:bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("register")}
          data-testid="tab-register"
        >
          {t("register")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {tab === "register" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("first_name")}</label>
                <Input
                  placeholder={t("first_name_placeholder")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("last_name")}</label>
                <Input
                  placeholder={t("last_name_placeholder")}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("phone_number")}</label>
              <Input
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("business_name")}</label>
              <Input
                placeholder={t("business_name_placeholder")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                data-testid="input-business-name"
                className="h-10 text-sm"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
            {tab === "login" ? t("email_or_phone") : t("email")}
          </label>
          <Input
            type={tab === "login" ? "text" : "email"}
            placeholder={tab === "login" ? t("email_or_phone_placeholder") : t("email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete={tab === "login" ? "username" : "email"}
            data-testid="input-email"
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("password")}</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-10 text-sm pr-10"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              data-testid="input-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t("hide_password") : t("show_password")}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {tab === "login" && (
          <div className="text-right -mt-2">
            <button
              type="button"
              className="text-xs text-primary font-semibold hover:underline"
              onClick={() => setLocation("/reset-password?account=owner")}
              data-testid="button-forgot-owner-password"
            >
              {t("forgot_password", "Mot de passe oublié ?")}
            </button>
          </div>
        )}

        {tab === "register" && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox
              id="registration-legal-acceptance"
              checked={acceptedLegal}
              onCheckedChange={(checked) => setAcceptedLegal(checked === true)}
              data-testid="checkbox-registration-legal"
            />
            <Label htmlFor="registration-legal-acceptance" className="text-xs leading-relaxed text-muted-foreground">
              I have read and agree to the{" "}
              <a className="font-semibold text-primary hover:underline" href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>
              ,{" "}
              <a className="font-semibold text-primary hover:underline" href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              , and{" "}
              <a className="font-semibold text-primary hover:underline" href="/cookies" target="_blank" rel="noopener noreferrer">
                Cookie Policy
              </a>
              .
            </Label>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 font-semibold text-sm mt-1"
          disabled={submitting || (tab === "register" && !acceptedLegal)}
          data-testid="button-auth-submit"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("please_wait")}
            </span>
          ) : tab === "login" ? (
            t("sign_in")
          ) : (
            t("create_my_account")
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center">
        {tab === "login" ? (
          <>
            {t("dont_have_account")}{" "}
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              onClick={() => setTab("register")}
            >
              {t("register")}
            </button>
          </>
        ) : (
          <>
            {t("already_have_account")}{" "}
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              onClick={() => setTab("login")}
            >
              {t("sign_in")}
            </button>
          </>
        )}
      </p>
      {tab === "login" && (
        <p className="text-xs text-muted-foreground text-center">
          Staff member?{" "}
          <button
            type="button"
            className="text-primary font-semibold hover:underline"
            onClick={() => setLocation("/staff-login")}
          >
            Use staff login
          </button>
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");

  useEffect(() => {
    if (!isLoading && user) setLocation("/");
  }, [user, isLoading, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col w-full max-w-[460px] min-h-screen bg-background overflow-hidden">

        {/* Zone 1: Brand + Language */}
        <div className="flex items-center justify-between px-8 pt-7 pb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shirt className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-foreground">XpressPro</span>
          </div>
          <div
            className="flex items-center gap-0.5 bg-muted rounded-lg p-1"
            aria-label={t("language")}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => i18n.changeLanguage(lang.code)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  i18n.resolvedLanguage === lang.code || i18n.language === lang.code
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone 2: Product promise + Auth form (vertically centered) */}
        <div className="flex-1 flex flex-col justify-center px-8 py-4 overflow-y-auto min-h-0">
          <div className="space-y-6 w-full">

            {/* Product promise */}
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-2">
                {t("auth_eyebrow")}
              </p>
              <h2 className="font-display font-bold text-xl leading-snug text-foreground">
                {t("auth_hero_title")}{" "}
                <span className="text-primary">{t("auth_hero_title_accent")}</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {t("auth_hero_subtitle")}
              </p>
            </div>

            {/* Auth form + heading */}
            <div>
              <div className="mb-5">
                <h1 className="font-display font-bold text-2xl text-foreground leading-tight">
                  {tab === "login" ? t("welcome") : t("create_account")}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {tab === "login" ? t("auth_dashboard_subtitle") : t("auth_setup_subtitle")}
                </p>
              </div>
              <AuthForm tab={tab} setTab={setTab} />
            </div>

          </div>
        </div>

        {/* Zone 3: Utility tools + copyright */}
        <div className="shrink-0 px-8 pt-4 pb-6 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
            {t("auth_tools_heading")}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <a href="/diagnostic">
              <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-xs py-1 font-medium">
                {t("auth_tool_diagnostic_button")}
              </Badge>
            </a>
            <a href="/calculateur">
              <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-xs py-1 font-medium">
                {t("auth_tool_launch_button")}
              </Badge>
            </a>
            <a href="/rentabilite">
              <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-xs py-1 font-medium">
                {t("auth_tool_profit_button")}
              </Badge>
            </a>
          </div>
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} XpressPro · {t("all_rights_reserved")}
          </p>
        </div>

      </div>
    </div>
  );
}
