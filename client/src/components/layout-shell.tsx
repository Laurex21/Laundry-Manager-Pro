import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { isDemoMode, exitDemoMode } from "@/lib/demo-mode";
import { useCurrency, type Currency } from "@/hooks/use-currency";
import {
  LayoutDashboard, ShoppingBag, Users, Menu, LogOut, Shirt, DollarSign,
  Globe, Banknote, CreditCard, BarChart3, Check, Cog, UserCheck, TrendingUp,
  Settings, Building2, ChevronDown, MoreHorizontal, ChevronRight,
  ListChecks, ChartNoAxesCombined,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useAuth } from "@/hooks/use-auth";
import { LegalAcceptanceGate } from "@/components/legal-acceptance-gate";
import { clearWhatsAppDevicePreference, useWhatsAppLauncher } from "@/components/whatsapp-launcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const ALL_NAV_ITEMS = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/", page: "dashboard" },
  { icon: ShoppingBag, labelKey: "orders", href: "/orders", page: "orders" },
  { icon: Users, labelKey: "customers", href: "/customers", page: "customers" },
  { icon: Shirt, labelKey: "services", href: "/services", page: "services" },
  { icon: DollarSign, labelKey: "expenses", href: "/expenses", page: "expenses" },
  { icon: CreditCard, labelKey: "payments", href: "/payments", page: "payments" },
  { icon: BarChart3, labelKey: "reports", href: "/reports", page: "reports" },
  { icon: Cog, labelKey: "machines", href: "/machines", page: "machines" },
  { icon: UserCheck, labelKey: "employees", href: "/employees", page: "employees" },
  { icon: TrendingUp, labelKey: "analytics", href: "/analytics", page: "analytics" },
  { icon: ListChecks, labelKey: "subscription_plans", href: "/membership-plans", page: "customers" },
  { icon: ChartNoAxesCombined, labelKey: "subscription_dashboard", href: "/subscription-dashboard", page: "customers" },
  { icon: CreditCard, labelKey: "subscription", href: "/subscriptions", page: "subscriptions" },
  { icon: Settings, labelKey: "settings", href: "/settings", page: "settings" },
];

const BOTTOM_NAV_PAGES = ["dashboard", "orders", "customers", "payments"];

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "pt", label: "Português", short: "PT" },
];

const CURRENCIES: { code: Currency; labelKey: string; symbol: string }[] = [
  { code: "FCFA", labelKey: "currency_fcfa", symbol: "FCFA" },
  { code: "NGN", labelKey: "currency_naira", symbol: "₦" },
  { code: "ZAR", labelKey: "currency_rand", symbol: "R" },
  { code: "MRU", labelKey: "currency_ouguiya", symbol: "UM" },
  { code: "USD", labelKey: "currency_us_dollar", symbol: "$" },
  { code: "EUR", labelKey: "currency_euro", symbol: "€" },
];

const WHATSAPP_SUPPORT_URL = "https://wa.me/237651638889";

const PAGE_TITLES: Record<string, string> = {
  "/": "dashboard",
  "/orders": "orders",
  "/customers": "customers",
  "/services": "services",
  "/expenses": "expenses",
  "/payments": "payments",
  "/reports": "reports",
  "/machines": "machines",
  "/employees": "employees",
  "/analytics": "analytics",
  "/subscriptions": "subscription",
  "/membership-plans": "subscription_plans",
  "/subscription-dashboard": "subscription_dashboard",
  "/settings": "settings",
};

function RegionalSettings() {
  const { t, i18n } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];
  const currentCurrency = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <div className="flex items-center gap-0.5" data-testid="regional-settings">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground px-2.5 h-8"
            data-testid="button-language-toggle"
          >
            <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-xs font-medium hidden sm:inline">{currentLang.short}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground pb-1">{t("language")}</DropdownMenuLabel>
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={cn("flex items-center justify-between gap-2 text-sm", i18n.language === lang.code && "text-primary font-semibold")}
              data-testid={`menu-item-lang-${lang.code}`}
            >
              <span>{lang.label}</span>
              {i18n.language === lang.code && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground px-2.5 h-8"
            data-testid="button-currency-toggle"
          >
            <Banknote className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-xs font-medium hidden sm:inline">{t(currentCurrency.labelKey)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground pb-1">{t("currency_label")}</DropdownMenuLabel>
          {CURRENCIES.map((cur) => (
            <DropdownMenuItem
              key={cur.code}
              onClick={() => setCurrency(cur.code)}
              className={cn("flex items-center justify-between gap-2 text-sm", currency === cur.code && "text-primary font-semibold")}
              data-testid={`menu-item-currency-${cur.code}`}
            >
              <span>{cur.symbol} {t(cur.labelKey)}</span>
              {currency === cur.code && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SiteSwitcher() {
  const { t } = useTranslation();
  const { currentSite, allSites, isOwner, userRole, switchSite, isSwitchingSite } = useAuth();

  if (!isOwner && !currentSite) return null;

  if (!isOwner) {
    return (
      <div className="px-3 py-2 mb-1">
        <div className="flex items-center gap-2 px-2.5 py-2 bg-muted/50 rounded-lg">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate flex-1">{currentSite?.name || t("main_site")}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-auto ml-auto">{userRole}</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 mb-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs h-8 bg-muted/50 hover:bg-muted font-medium text-foreground"
            disabled={isSwitchingSite}
            data-testid="button-site-switcher"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{currentSite ? currentSite.name : t("all_sites")}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground pb-1">{t("switch_site")}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => switchSite(null)}
            className={cn("text-sm", !currentSite && "font-semibold text-primary")}
            data-testid="menu-item-all-sites"
          >
            <LayoutDashboard className="w-3.5 h-3.5 mr-2" />
            {t("all_sites")}
            {!currentSite && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {allSites.map((site: any) => (
            <DropdownMenuItem
              key={site.id}
              onClick={() => switchSite(site.id)}
              className={cn("text-sm", currentSite?.id === site.id && "font-semibold text-primary")}
              data-testid={`menu-item-site-${site.id}`}
            >
              <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              {site.name}
              {currentSite?.id === site.id && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600 border-slate-200",
  starter: "bg-blue-50 text-blue-700 border-blue-200",
  pro: "bg-violet-50 text-violet-700 border-violet-200",
  enterprise: "bg-amber-50 text-amber-700 border-amber-200",
};

function DemoBanner() {
  const { t } = useTranslation();
  if (!isDemoMode()) return null;
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 flex items-center justify-between px-4 py-1.5 gap-3 shrink-0">
      <span className="text-[11px] font-medium text-amber-800 tracking-wide">{t("demo_mode_banner")}</span>
      <button
        onClick={exitDemoMode}
        className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
        data-testid="button-exit-demo"
      >
        {t("demo_exit")}
      </button>
    </div>
  );
}

function WhatsAppContactButton() {
  const { t } = useTranslation();
  const { openWhatsApp } = useWhatsAppLauncher();

  return (
    <button
      type="button"
      onClick={() => openWhatsApp({ phone: WHATSAPP_SUPPORT_URL.replace("https://wa.me/", "") })}
      className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#1ebe5d] focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 lg:bottom-6 lg:right-6"
      aria-label={t("whatsapp_contact_support")}
      data-testid="button-whatsapp-support"
    >
      <FaWhatsapp className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">{t("whatsapp_contact_support")}</span>
    </button>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, planSlug, canAccess } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = ALL_NAV_ITEMS.filter((item) => canAccess(item.page));
  const bottomNavItems = ALL_NAV_ITEMS.filter(
    (item) => item.href !== "/membership-plans" && BOTTOM_NAV_PAGES.includes(item.page) && canAccess(item.page)
  );

  const pageTitleKey = PAGE_TITLES[location] || "dashboard";
  const planColor = PLAN_COLORS[planSlug] || PLAN_COLORS.free;

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
            <Shirt className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[15px] tracking-tight leading-tight">XpressPro</h1>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">{t("laundry_manager")}</p>
          </div>
        </div>
      </div>

      {/* Site switcher */}
      <div className="pt-3">
        <SiteSwitcher />
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.page}`}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="flex-1">{t(item.labelKey)}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-foreground/60 shrink-0" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: plan + user */}
      <div className="px-3 pb-4 border-t border-border/60 pt-3 space-y-3">
        {/* Plan badge */}
        <div
          className={cn("flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold", planColor)}
          data-testid="plan-badge"
        >
          <span className="uppercase tracking-wide">{t("current_plan")}</span>
          <span className="capitalize">{planSlug}</span>
        </div>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-1">
          <Avatar className="w-8 h-8 border border-border shrink-0">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs font-semibold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-[#128C7E] shrink-0"
            onClick={clearWhatsAppDevicePreference}
            data-testid="button-change-whatsapp-app"
            title={t("change_whatsapp_app")}
            aria-label={t("change_whatsapp_app")}
          >
            <FaWhatsapp className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => logout()}
            data-testid="button-sign-out"
            title={t("sign_out")}
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex overflow-x-hidden w-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 bg-card border-r border-border fixed inset-y-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <NavContent />
        </SheetContent>
      </Sheet>

      <main className="flex-1 lg:ml-60 min-h-screen flex flex-col min-w-0 overflow-x-hidden">
        {/* Top header */}
        <header
          className="h-14 bg-card/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 sm:px-5 sticky top-0 z-20"
          data-testid="top-navbar"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 text-muted-foreground"
              onClick={() => setMobileOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-4.5 h-4.5" />
            </Button>
            <div>
              <h2 className="font-display font-bold text-base leading-tight capitalize">
                {t(pageTitleKey)}
              </h2>
            </div>
          </div>
          <RegionalSettings />
        </header>

        {/* Demo banner */}
        <DemoBanner />

        {/* Page content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8 min-w-0 overflow-x-hidden">
          {children}
        </div>
      </main>

      <WhatsAppContactButton />
      <LegalAcceptanceGate />

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border flex items-stretch pb-[env(safe-area-inset-bottom)]"
        data-testid="bottom-nav"
      >
        {bottomNavItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`bottom-nav-${item.page}`}
              >
                <item.icon className={cn("w-4.5 h-4.5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-semibold leading-none">{t(item.labelKey)}</span>
              </div>
            </Link>
          );
        })}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-muted-foreground"
          onClick={() => setMobileOpen(true)}
          data-testid="bottom-nav-more"
        >
          <MoreHorizontal className="w-4.5 h-4.5" />
          <span className="text-[10px] font-semibold leading-none">{t("more")}</span>
        </button>
      </nav>
    </div>
  );
}
