import { readPlanIntent, planIntentUrl } from "@/lib/saas-plan-intent";
import { SaasPlanIntent } from "@/components/saas-plan-intent";
import { authErrorMessage } from "@/lib/auth-errors";
import { waitForAcquisition, acquisitionRegistrationConsent } from "@/lib/acquisition";
import { recordWelcomeEligibility } from "@/lib/onboarding-welcome";
import { SaasTrialInfo } from "@/components/saas-public-plans";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, EyeOff, Loader2, ClipboardList, Users, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { trackMarketingEvent, pixelWasLoaded, waitForMarketingDispatch } from "@/lib/marketing";
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
  const search = useSearch();
  const selectedPlan = readPlanIntent(search);
  const destination = selectedPlan ? planIntentUrl("/subscriptions", selectedPlan) : "/";
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<{message: unknown; status: number; retryAfter: string | null} | null>(null);
  useEffect(() => { setFormError(null); setShowPassword(false); }, [tab]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (tab === "register" && password.length < 10) {
      toast({
        title: t("error"),
        description: t("registration_password_rule"),
        variant: "destructive",
      });
      return;
    }
    if (tab === "register" && password !== confirmPassword) {
      toast({
        title: t("error"),
        description: t("passwords_do_not_match"),
        variant: "destructive",
      });
      return;
    }
    if (tab === "register" && !acceptedLegal) {
      toast({
        title: t("error"),
        description: t("legal_acceptance_required_register"),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      if (tab === "register") await waitForAcquisition();
      const body =
        tab === "login"
          ? { email: email.trim().toLowerCase(), password }
          : { email: email.trim().toLowerCase(), password, firstName, lastName, phone, businessName, acceptedLegal, ...acquisitionRegistrationConsent() };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError({message: data.message, status: res.status, retryAfter: res.headers.get("Retry-After")});
        return;
      }

      if (tab === "register") {
        trackEvent("signup_completed");
        trackMarketingEvent("signup_completed");
        await waitForMarketingDispatch();
      }
      if (data?.id) {
        try { recordWelcomeEligibility(window.sessionStorage, data.id, tab === "register"); } catch { /* Authentication remains usable without storage. */ }
      }
      queryClient.setQueryData(["/api/auth/user"], data);
      // Leave the document containing the marketing SDK before entering the app.
      if (pixelWasLoaded()) window.location.assign(destination);
      else setLocation(destination);
    } catch {
      setFormError({message: "AUTH_NETWORK_ERROR", status: 0, retryAfter: null});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Tab switcher */}
      <div role="tablist" aria-label={t("auth_owner_access")} className="flex bg-slate-100 dark:bg-muted rounded-lg p-1 gap-1">
        <button
          className={`flex-1 min-h-11 py-2 text-sm font-semibold rounded-md transition-all ${
            tab === "login"
              ? "bg-white dark:bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          role="tab" id="auth-login-tab" aria-selected={tab === "login"} aria-controls="auth-form-panel"
          tabIndex={tab === "login" ? 0 : -1}
          onKeyDown={e => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); setTab("register"); document.getElementById("auth-register-tab")?.focus(); } }}
          onClick={() => setTab("login")}
          data-testid="tab-login"
        >
          {t("sign_in")}
        </button>
        <button
          className={`flex-1 min-h-11 py-2 text-sm font-semibold rounded-md transition-all ${
            tab === "register"
              ? "bg-white dark:bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          role="tab" id="auth-register-tab" aria-selected={tab === "register"} aria-controls="auth-form-panel"
          tabIndex={tab === "register" ? 0 : -1}
          onKeyDown={e => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); setTab("login"); document.getElementById("auth-login-tab")?.focus(); } }}
          onClick={() => setTab("register")}
          data-testid="tab-register"
        >
          {t("register")}
        </button>
      </div>

      <form id="auth-form-panel" role="tabpanel" aria-labelledby={tab === "login" ? "auth-login-tab" : "auth-register-tab"} onSubmit={handleSubmit} className="space-y-4">
        {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{authErrorMessage(formError.message, formError.status, formError.retryAfter, t)}</p>}
        {tab === "register" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="auth-first-name" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("first_name")}</label>
                <Input
                  id="auth-first-name" autoComplete="given-name"
                  placeholder={t("first_name_placeholder")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="auth-last-name" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("last_name")}</label>
                <Input
                  id="auth-last-name" autoComplete="family-name"
                  placeholder={t("last_name_placeholder")}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                  className="h-11 text-base"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auth-phone" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("phone_number")}</label>
              <Input
                id="auth-phone" autoComplete="tel"
                  type="tel"
                placeholder="+237 6XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auth-business" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("business_name")}</label>
              <Input
                id="auth-business" autoComplete="organization"
                  placeholder={t("business_name_placeholder")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                data-testid="input-business-name"
                className="h-11 text-base"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
            {t("email")}
          </label>
          <Input
            id="auth-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} aria-describedby="auth-email-hint"
            placeholder={t("email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete={tab === "login" ? "username" : "email"}
            data-testid="input-email"
            className="h-11 text-base"
          />
          <p id="auth-email-hint" className="text-xs text-muted-foreground">{t("auth_email_hint")}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-password" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{t("password")}</label>
          <div className="relative">
            <Input
              id="auth-password" name="password" type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={tab === "register" ? 10 : undefined}
              className="h-11 text-base pr-12"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              data-testid="input-password"
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 min-h-11 min-w-11 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              aria-pressed={showPassword}
              aria-label={showPassword ? t("hide_password") : t("show_password")}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {tab === "register" && (
            <p className="text-xs leading-relaxed text-muted-foreground" data-testid="registration-password-rule">
              {t("registration_password_rule")}
            </p>
          )}
        </div>

        {tab === "register" && (
          <div className="space-y-1.5">
            <label htmlFor="auth-confirm-password" className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              {t("confirm_password")}
            </label>
            <div className="relative">
              <Input
                id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={10}
                className="h-11 text-base pr-12"
                autoComplete="new-password"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 -translate-y-1/2 min-h-11 min-w-11 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-pressed={showConfirmPassword}
                aria-label={showConfirmPassword ? t("hide_password") : t("show_password")}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {tab === "login" && (
          <div className="text-right -mt-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center text-sm text-primary font-semibold hover:underline"
              onClick={() => setLocation("/reset-password?account=owner")}
              data-testid="button-forgot-owner-password"
            >
              {t("forgot_password")}
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
              {t("legal_acceptance_read_agree_prefix")}{" "}
              <a className="font-semibold text-primary hover:underline" href="/terms" target="_blank" rel="noopener noreferrer">
                {t("terms_of_service")}
              </a>
              ,{" "}
              <a className="font-semibold text-primary hover:underline" href="/privacy" target="_blank" rel="noopener noreferrer">
                {t("privacy_policy")}
              </a>
              , {t("and")}{" "}
              <a className="font-semibold text-primary hover:underline" href="/cookies" target="_blank" rel="noopener noreferrer">
                {t("cookie_policy")}
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
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">{t("staff_member_prompt")}</p>{" "}
          <button
            type="button"
            className="min-h-11 w-full rounded-lg border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/10"
            onClick={() => setLocation("/staff-login")}
          >
            {t("use_staff_login")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const selectedPlan = readPlanIntent(search);
  const destination = selectedPlan ? planIntentUrl("/subscriptions", selectedPlan) : "/";
  const [tab, setTab] = useState<"login" | "register">(requestedTab === "register" ? "register" : "login");

  useEffect(() => {
    setTab(requestedTab === "register" ? "register" : "login");
  }, [requestedTab]);

  useEffect(() => {
    if (!isLoading && user) setLocation(destination);
  }, [user, isLoading, setLocation, destination]);

  const changeTab = (nextTab: "login" | "register") => {
    setTab(nextTab);
    setLocation(planIntentUrl("/auth", selectedPlan, nextTab));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col w-full max-w-[1100px] min-h-screen lg:min-h-0 lg:my-8 bg-background overflow-hidden">

        {/* Zone 1: Brand + Language */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-7 pb-5 shrink-0 sm:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/xpresspro-mark.svg" alt="" className="h-8 w-8" />
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
                aria-pressed={i18n.resolvedLanguage === lang.code || i18n.language === lang.code}
                aria-label={lang.code === "fr" ? "Français" : lang.code === "pt" ? "Português" : "English"}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={`min-h-11 min-w-11 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
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
        <div className="flex-1 px-6 py-4 sm:px-8 lg:py-8">
          <div className="grid w-full gap-5 lg:grid-cols-2 lg:items-start lg:gap-16">

            {/* Product promise */}
            <div className="lg:rounded-3xl lg:bg-primary/5 lg:p-8">
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-2">
                {t("auth_eyebrow")}
              </p>
              <h2 className="font-display font-bold text-2xl lg:text-4xl leading-snug text-foreground">
                {t("auth_hero_title")}{" "}
                <span className="text-primary">{t("auth_hero_title_accent")}</span>
              </h2>
              <p className="hidden text-sm text-muted-foreground mt-1.5 leading-relaxed sm:block">
                {t("auth_hero_subtitle")}
              </p>
              <ul className="mt-8 hidden space-y-4 lg:block">{[[ClipboardList, 'orders'], [Users, 'customers'], [Wallet, 'payments']].map(([Icon, key]) => { const FeatureIcon = Icon as typeof ClipboardList; return <li key={String(key)} className="flex items-center gap-3 rounded-xl bg-background/80 p-4 text-sm font-medium"><FeatureIcon className="h-5 w-5 text-primary" aria-hidden="true" />{t(String(key))}</li>; })}</ul>
            </div>

            {/* Auth form + heading */}
            <div className="lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-7 lg:shadow-sm">
              <div className="mb-5">
                <h1 className="font-display font-bold text-2xl text-foreground leading-tight">
                  {tab === "login" ? t("welcome") : t("create_account")}
                </h1>
            {tab === "register" && <SaasTrialInfo />}
                <SaasPlanIntent selection={selectedPlan} />
                <p className="text-muted-foreground text-sm mt-1">
                  {tab === "login" ? t("auth_dashboard_subtitle") : t("auth_setup_subtitle")}
                </p>
              </div>
              <AuthForm tab={tab} setTab={changeTab} />
            </div>

          </div>
        </div>

        {/* Zone 3: Utility tools + copyright */}
        <div className="shrink-0 px-6 pt-4 pb-6 border-t border-border sm:px-8">
          <a href="/" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            {t("back_to_public_site")}
          </a>
          <details className="mb-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-muted-foreground">{t("auth_show_tools")}</summary>
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
          </details>
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} XpressPro · {t("all_rights_reserved")}
          </p>
        </div>

      </div>
    </div>
  );
}
