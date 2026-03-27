import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency, type Currency } from "@/hooks/use-currency";
import { 
  LayoutDashboard, ShoppingBag, Users, Menu, LogOut, Shirt, DollarSign,
  Globe, Banknote, CreditCard, BarChart3, Check, Cog, UserCheck, TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/" },
  { icon: ShoppingBag, labelKey: "orders", href: "/orders" },
  { icon: Users, labelKey: "customers", href: "/customers" },
  { icon: Shirt, labelKey: "services", href: "/services" },
  { icon: DollarSign, labelKey: "expenses", href: "/expenses" },
  { icon: CreditCard, labelKey: "payments", href: "/payments" },
  { icon: BarChart3, labelKey: "reports", href: "/reports" },
  { icon: Cog, labelKey: "machines", href: "/machines" },
  { icon: UserCheck, labelKey: "employees", href: "/employees" },
  { icon: TrendingUp, labelKey: "analytics", href: "/analytics" },
  { icon: CreditCard, labelKey: "subscription", href: "/subscriptions" },
];

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "fr", label: "Français", short: "FR" },
];

const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "NGN", label: "Nigerian Naira", symbol: "₦" },
  { code: "XOF", label: "CFA Franc", symbol: "CFA" },
  { code: "EUR", label: "Euro", symbol: "€" },
];

function RegionalSettings() {
  const { t, i18n } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];
  const currentCurrency = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <div className="flex items-center gap-1" data-testid="regional-settings">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" data-testid="button-language-toggle">
            <Globe className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-xs font-medium">{currentLang.short}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("language")}</DropdownMenuLabel>
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}
              className={cn("flex items-center justify-between gap-2", i18n.language === lang.code && "text-primary font-semibold")} data-testid={`menu-item-lang-${lang.code}`}>
              <span>{lang.label}</span>
              {i18n.language === lang.code && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="h-5 mx-0.5" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" data-testid="button-currency-toggle">
            <Banknote className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-xs font-medium">{currentCurrency.code}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("currency_label")}</DropdownMenuLabel>
          {CURRENCIES.map((cur) => (
            <DropdownMenuItem key={cur.code} onClick={() => setCurrency(cur.code)}
              className={cn("flex items-center justify-between gap-2", currency === cur.code && "text-primary font-semibold")} data-testid={`menu-item-currency-${cur.code}`}>
              <span>{cur.symbol} {cur.label}</span>
              {currency === cur.code && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, planSlug } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Shirt className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight">CleanEase</h1>
            <p className="text-xs text-muted-foreground font-medium">{t('laundry_manager')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                {t(item.labelKey)}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border mt-auto space-y-2">
        <div className="px-3 py-2 bg-muted/50 rounded-lg mb-2" data-testid="plan-badge">
          <p className="text-xs font-medium text-muted-foreground">{t("current_plan")}</p>
          <p className="text-sm font-bold capitalize">{planSlug}</p>
        </div>
        <div className="flex items-center gap-3 px-2 mb-2 pt-2">
          <Avatar className="w-9 h-9 border border-border">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={() => logout()} data-testid="button-sign-out">
          <LogOut className="w-4 h-4 mr-2" />
          {t('sign_out')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 flex">
      <aside className="hidden lg:block w-64 bg-card border-r border-border fixed inset-y-0 z-30">
        <NavContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <NavContent />
        </SheetContent>
      </Sheet>

      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-20" data-testid="top-navbar">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-display font-bold text-lg lg:hidden">CleanEase</span>
          </div>
          <RegionalSettings />
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
