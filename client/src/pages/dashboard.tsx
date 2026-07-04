import { useStats } from "@/hooks/use-stats";
import { useOrders } from "@/hooks/use-orders";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useAuth } from "@/hooks/use-auth";
import {
  ShoppingBag, Users, DollarSign, Clock, ChevronRight, Plus,
  AlertCircle, AlertTriangle, Info, Building2, MapPin, UserCheck,
  TrendingUp, CalendarDays, Package, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { orderDisplayId } from "@/lib/order-display";
import { formatBusinessDateTime } from "@/lib/date-time";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

const QUEUE_STAGES = [
  { key: "received", colorCls: "text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400" },
  { key: "washing",  colorCls: "text-sky-700 bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30 dark:text-sky-400" },
  { key: "ready",    colorCls: "text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400" },
  { key: "delivered",colorCls: "text-muted-foreground bg-muted/40 border-border/40" },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: recentOrders, isLoading: ordersLoading } = useOrders();
  const { data: dashData } = useQuery<any>({ queryKey: ["/api/analytics/dashboard"] });
  const { data: behaviorData } = useQuery<any>({ queryKey: ["/api/analytics/customer-behavior", "month"], queryFn: () => fetch("/api/analytics/customer-behavior?period=month", { credentials: "include" }).then((res) => res.json()) });
  const { data: storageWaiting } = useQuery<any[]>({ queryKey: ["/api/analytics/storage-occupancy"] });
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const { currentSite, allSites, isOwner, userRole, switchSite, isSwitchingSite } = useAuth();
  const symbol = getSymbol();

  const isAllSitesMode = isOwner && currentSite === null;
  const sitesOverview: any[] = dashData?.sitesOverview ?? [];
  const siteCount = dashData?.siteCount ?? allSites.length;
  const latestOrders = recentOrders?.slice().sort((a: any, b: any) => b.id - a.id).slice(0, 6) || [];
  const readyForPickup: any[] = dashData?.readyForPickup ?? [];
  const churnCount = behaviorData?.churn?.atRiskCount ?? 0;

  if (statsLoading) return <DashboardSkeleton />;

  const alerts = dashData?.alerts || [];
  const monthProfit = (dashData?.monthRevenue || 0) - (dashData?.monthExpenses || 0);
  const ordersByStatus = dashData?.ordersByStatus;

  return (
    <div className="space-y-4 page-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between min-h-[2rem]">
        <div>
          <h1 className="text-sm font-semibold text-foreground" data-testid="text-dashboard-title">
            {t('dashboard')}
          </h1>
          <p className="text-[11px] text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        {!isAllSitesMode && currentSite && (
          <div className="flex items-center gap-1.5" data-testid="banner-current-site">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline">{currentSite.name}</span>
            {currentSite.city && <span className="text-xs text-muted-foreground hidden sm:inline opacity-60">· {currentSite.city}</span>}
            <Badge variant="outline" className="capitalize text-[10px] h-5">{userRole}</Badge>
          </div>
        )}
      </div>

      {/* Operations command strip */}
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-row sm:items-center sm:gap-px bg-muted/20 border border-border/50 rounded-lg p-1 w-full min-w-0">
        <Link href="/orders" className="contents sm:inline-flex">
          <Button size="sm" className="h-7 text-xs px-3 rounded-md font-medium w-full sm:w-auto" data-testid="button-new-order">
            <Plus className="w-3.5 h-3.5 mr-1.5" />{t('new_order')}
          </Button>
        </Link>
        <div className="hidden sm:block w-px h-4 bg-border/60 mx-1.5 shrink-0" />
        <Link href="/payments" className="contents sm:inline-flex">
          <Button variant="ghost" size="sm" className="h-7 text-xs px-3 rounded-md w-full sm:w-auto">
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />{t('register_payment')}
          </Button>
        </Link>
        <Link href="/orders" className="contents sm:inline-flex">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs px-3 rounded-md w-full sm:w-auto${readyForPickup.length > 0 ? " text-emerald-700 dark:text-emerald-400" : ""}`}
          >
            <Package className="w-3.5 h-3.5 mr-1.5" />
            {t('ready_for_pickup')}
            {readyForPickup.length > 0 && (
              <span className="ml-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm tabular-nums">
                {readyForPickup.length}
              </span>
            )}
          </Button>
        </Link>
        <div className="hidden sm:block w-px h-4 bg-border/60 mx-1.5 shrink-0" />
        <Link href="/customers" className="contents sm:inline-flex">
          <Button variant="ghost" size="sm" className="h-7 text-xs px-3 rounded-md w-full sm:w-auto">
            <Users className="w-3.5 h-3.5 mr-1.5" />{t('customers')}
          </Button>
        </Link>
        <Link href="/reports" className="contents sm:inline-flex">
          <Button variant="ghost" size="sm" className="h-7 text-xs px-3 rounded-md w-full sm:w-auto">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />{t('reports')}
          </Button>
        </Link>
      </div>

      {/* All-sites banner */}
      {isAllSitesMode && (
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-lg bg-primary/5 border border-primary/15" data-testid="banner-all-sites">
          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm font-medium text-foreground">{t('all_sites_view')}</p>
          <span className="text-xs text-muted-foreground hidden sm:inline">· {t('all_sites_subtitle', { count: siteCount })}</span>
          <Badge variant="secondary" className="ml-auto hidden sm:flex text-xs">{t('consolidated_data')}</Badge>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5" data-testid="dashboard-alerts">
          {alerts.map((alert: any, i: number) => {
            const styles: Record<string, { bg: string; icon: any }> = {
              danger:  { bg: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400",    icon: AlertCircle },
              warning: { bg: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400", icon: AlertTriangle },
              info:    { bg: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400",   icon: Info },
            };
            const s = styles[alert.type] || styles.info;
            const Icon = s.icon;
            return (
              <div key={i} className={`flex items-center gap-3 px-3.5 py-2 rounded-lg border text-sm ${s.bg}`} data-testid={`alert-banner-${i}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{alert.message}</span>
                {alert.detail && <span className="ml-1 opacity-75">{alert.detail}</span>}
              </div>
            );
          })}
        </div>
      )}

      {churnCount > 0 && (
        <Link href="/analytics">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-lg border bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-900 dark:text-orange-300 cursor-pointer" data-testid="banner-churn-risk">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{churnCount} clients à risque de perte</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </div>
        </Link>
      )}

      {/* Workflow queue strip */}
      {ordersByStatus && (
        <div data-testid="card-orders-status-chart">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {t('order_pipeline')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUEUE_STAGES.map(({ key, colorCls }) => (
              <Link href="/orders" key={key}>
                <div className={`rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-sm transition-shadow min-w-0 ${colorCls}`}>
                  <p className="text-xl font-bold tabular-nums leading-none">{ordersByStatus[key] ?? 0}</p>
                  <p className="text-[11px] mt-1 font-medium opacity-75">{t(`stage_${key}` as any)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI groups */}
      <div className="space-y-3">
        {/* Today */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <CalendarDays className="w-3 h-3" />{t('today')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label={t('today_orders')} value={dashData?.todayOrders ?? 0} icon={ShoppingBag} color="neutral" data-testid="card-today-orders" />
            <MetricCard label={t('today_revenue')} value={`${symbol}${(dashData?.todayRevenue || 0).toFixed(2)}`} icon={DollarSign} color="green" data-testid="card-today-revenue" />
            <MetricCard label={t('pending_orders')} value={stats?.pendingOrders || 0} icon={Clock} color="amber" data-testid="card-pending-orders" />
            <MetricCard label={t('ready_for_pickup')} value={readyForPickup.length} icon={Package} color="emerald" data-testid="card-ready-count" />
          </div>
        </div>

        {/* This Week */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3 h-3" />{t('this_week')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label={t('week_orders')} value={dashData?.weekOrders ?? 0} icon={ShoppingBag} color="neutral" data-testid="card-week-orders" />
            <MetricCard label={t('week_revenue')} value={`${symbol}${(dashData?.weekRevenue || 0).toFixed(2)}`} icon={DollarSign} color="green" data-testid="card-week-revenue" />
          </div>
        </div>

        {/* This Month */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <CalendarDays className="w-3 h-3" />{t('this_month')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label={t('total_orders')} value={dashData?.monthOrders ?? stats?.totalOrders ?? 0} icon={ShoppingBag} color="neutral" data-testid="card-month-orders" />
            <MetricCard label={t('total_revenue')} value={`${symbol}${(dashData?.monthRevenue || stats?.totalRevenue || 0).toFixed(2)}`} icon={DollarSign} color="green" data-testid="card-month-revenue" />
            <MetricCard label={t('total_expenses_label')} value={`${symbol}${(dashData?.monthExpenses || 0).toFixed(2)}`} icon={DollarSign} color="red" data-testid="card-month-expenses" />
            <MetricCard label={t('net_profit')} value={`${symbol}${monthProfit.toFixed(2)}`} icon={TrendingUp} color={monthProfit >= 0 ? "green" : "red"} data-testid="card-month-profit" />
          </div>
        </div>
      </div>

      {/* Sites overview (owner / all-sites mode) */}
      {isAllSitesMode && sitesOverview.length > 0 && (
        <Card className="border-border/50" data-testid="card-sites-overview">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />{t('sites_overview')}
              </CardTitle>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-7">
                  {t('settings')} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="divide-y divide-border/40">
              {sitesOverview.map((site: any) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => switchSite(site.id)}
                  disabled={isSwitchingSite}
                  className="flex w-full items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-left rounded-md transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                  data-testid={`button-site-${site.id}`}
                >
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">{site.name}</p>
                    {site.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />{site.city}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      <UserCheck className="w-3 h-3 inline mr-0.5" />{t('site_members', { count: site.memberCount })}
                    </span>
                    <Badge variant={site.isActive ? "default" : "secondary"} className="text-[10px]">
                      {site.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid: Recent Orders + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Orders */}
        <Card className="lg:col-span-2 border-border/50" data-testid="card-recent-orders">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">{t('recent_orders')}</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-7">
                {t('view_all')} <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {ordersLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
            ) : latestOrders.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
                {t('no_orders_yet')}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {latestOrders.map((order: any) => (
                  <div key={order.id} className="group flex items-center justify-between py-2.5 hover:bg-muted/30 px-1 rounded transition-colors" data-testid={`row-order-${order.id}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground leading-tight">{order.customer?.name || `#${orderDisplayId(order)}`}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d", { locale: dateLocaleFor(i18n.language) })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} />
                      <span className="font-mono text-sm w-16 text-right">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Ready for Pickup */}
          {storageWaiting && storageWaiting.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-900/60" data-testid="card-storage-waiting">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  Vêtements en attente
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{storageWaiting.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="divide-y divide-border/30">
                  {storageWaiting.slice(0, 5).map((order: any) => (
                    <div key={order.id} className="py-2.5" data-testid={`row-storage-waiting-${order.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{order.customer?.name || `#${orderDisplayId(order)}`}</p>
                          <p className="text-xs text-muted-foreground">{order.customer?.phone || "-"} · {order.daysWaiting} jours</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatBusinessDateTime(order.readyDate)}</p>
                        </div>
                        {order.whatsappUrl && (
                          <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">WhatsApp</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ready for Pickup */}
          <Card className="border-border/50" data-testid="card-ready-for-pickup">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {t('ready_for_pickup')}
                {readyForPickup.length > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px] h-4 px-1">
                    {readyForPickup.length}
                  </Badge>
                )}
              </CardTitle>
              {readyForPickup.length > 0 && (
                <Link href="/orders">
                  <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-7">
                    {t('view_all')} <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {readyForPickup.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border/40 rounded-lg">
                  {t('no_pending_pickups')}
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  {readyForPickup.slice(0, 5).map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between py-2" data-testid={`row-ready-${order.id}`}>
                      <div>
                        <p className="text-sm font-medium leading-tight">{order.customer?.name || `#${orderDisplayId(order)}`}</p>
                        <p className="text-xs text-muted-foreground">{symbol}{Number(order.totalAmount).toFixed(2)}</p>
                      </div>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('quick_actions')}</p>
            <div className="rounded-lg border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
              <Link href="/customers">
                <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors cursor-pointer" data-testid="button-add-customer">
                  <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />{t('add_customer')}
                </div>
              </Link>
              <Link href="/expenses">
                <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors cursor-pointer" data-testid="button-log-expense">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />{t('log_expense')}
                </div>
              </Link>
              {isOwner && (
                <Link href="/settings">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors cursor-pointer" data-testid="button-manage-sites">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />{t('sites')}
                  </div>
                </Link>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, ...props }: any) {
  const iconCls: Record<string, string> = {
    neutral: "text-muted-foreground",
    green:   "text-emerald-600 dark:text-emerald-400",
    amber:   "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red:     "text-red-600 dark:text-red-400",
    blue:    "text-blue-600 dark:text-blue-400",
    orange:  "text-orange-600 dark:text-orange-400",
    indigo:  "text-indigo-600 dark:text-indigo-400",
  };
  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 min-w-0" {...props}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
        <Icon className={`w-3 h-3 flex-shrink-0 ${iconCls[color] ?? iconCls.neutral}`} />
      </div>
      <p className="text-lg font-semibold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-5 w-28 rounded" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[60px] rounded-lg" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-52 rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
