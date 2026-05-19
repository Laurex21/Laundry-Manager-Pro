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
  TrendingUp, CalendarDays, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const STATUS_COLORS = ["#3b82f6", "#f97316", "#10b981", "#8b5cf6"];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: recentOrders, isLoading: ordersLoading } = useOrders();
  const { data: dashData } = useQuery<any>({ queryKey: ["/api/analytics/dashboard"] });
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const { currentSite, allSites, isOwner, userRole } = useAuth();
  const symbol = getSymbol();

  const isAllSitesMode = isOwner && currentSite === null;
  const sitesOverview: any[] = dashData?.sitesOverview ?? [];
  const siteCount = dashData?.siteCount ?? allSites.length;
  const latestOrders = recentOrders?.slice().sort((a: any, b: any) => b.id - a.id).slice(0, 5) || [];
  const readyForPickup: any[] = dashData?.readyForPickup ?? [];

  if (statsLoading) return <DashboardSkeleton />;

  const alerts = dashData?.alerts || [];

  const orderStatusData = dashData?.ordersByStatus ? [
    { name: "Received", value: dashData.ordersByStatus.received },
    { name: "Washing", value: dashData.ordersByStatus.washing },
    { name: "Ready", value: dashData.ordersByStatus.ready },
    { name: "Delivered", value: dashData.ordersByStatus.delivered },
  ].filter(d => d.value > 0) : [];

  const monthProfit = (dashData?.monthRevenue || 0) - (dashData?.monthExpenses || 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground" data-testid="text-dashboard-title">{t('dashboard')}</h1>
          <p className="text-muted-foreground mt-1">{t('welcome')}! Here's what's happening.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/orders">
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all" data-testid="button-new-order">
              <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
            </Button>
          </Link>
        </div>
      </div>

      {isAllSitesMode ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15" data-testid="banner-all-sites">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{t('all_sites_view')}</p>
            <p className="text-sm text-muted-foreground">{t('all_sites_subtitle', { count: siteCount })}</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hidden sm:flex">{t('consolidated_data')}</Badge>
        </div>
      ) : currentSite ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50" data-testid="banner-current-site">
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t('viewing_site', { name: currentSite.name })}
            {currentSite.city && <span className="ml-1 opacity-70">· {currentSite.city}</span>}
          </p>
          <Badge variant="outline" className="ml-auto capitalize text-xs">{userRole}</Badge>
        </div>
      ) : null}

      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="dashboard-alerts">
          {alerts.map((alert: any, i: number) => {
            const styles: Record<string, { bg: string; icon: any }> = {
              danger: { bg: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400", icon: AlertCircle },
              warning: { bg: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-900 dark:text-yellow-400", icon: AlertTriangle },
              info: { bg: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400", icon: Info },
            };
            const s = styles[alert.type] || styles.info;
            const Icon = s.icon;
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${s.bg}`} data-testid={`alert-banner-${i}`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                <div>
                  <span className="font-medium">{alert.message}</span>
                  {alert.detail && <span className="ml-2 text-sm opacity-80">{alert.detail}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <CalendarDays className="w-3.5 h-3.5" /> Today
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label={t('today_orders')} value={dashData?.todayOrders ?? 0} icon={ShoppingBag} color="blue" data-testid="card-today-orders" />
          <MetricCard label={t('today_revenue')} value={`${symbol}${(dashData?.todayRevenue || 0).toFixed(2)}`} icon={DollarSign} color="green" data-testid="card-today-revenue" />
          <MetricCard label={t('pending_orders')} value={stats?.pendingOrders || 0} icon={Clock} color="orange" data-testid="card-pending-orders" />
          <MetricCard label={t('ready_for_pickup')} value={readyForPickup.length} icon={Package} color="indigo" data-testid="card-ready-count" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <TrendingUp className="w-3.5 h-3.5" /> This Week
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label={t('week_orders')} value={dashData?.weekOrders ?? 0} icon={ShoppingBag} color="blue" data-testid="card-week-orders" />
          <MetricCard label={t('week_revenue')} value={`${symbol}${(dashData?.weekRevenue || 0).toFixed(2)}`} icon={DollarSign} color="green" data-testid="card-week-revenue" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <CalendarDays className="w-3.5 h-3.5" /> This Month
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label={t('total_orders')} value={dashData?.monthOrders ?? stats?.totalOrders ?? 0} icon={ShoppingBag} color="blue" data-testid="card-month-orders" />
          <MetricCard label={t('total_revenue')} value={`${symbol}${(dashData?.monthRevenue || stats?.totalRevenue || 0).toFixed(2)}`} icon={DollarSign} color="green" data-testid="card-month-revenue" />
          <MetricCard label={t('total_expenses_label')} value={`${symbol}${(dashData?.monthExpenses || 0).toFixed(2)}`} icon={DollarSign} color="red" data-testid="card-month-expenses" />
          <MetricCard label={t('net_profit')} value={`${symbol}${monthProfit.toFixed(2)}`} icon={TrendingUp} color={monthProfit >= 0 ? "green" : "red"} data-testid="card-month-profit" />
        </div>
      </div>

      {isAllSitesMode && sitesOverview.length > 0 && (
        <Card className="shadow-md border-border/50" data-testid="card-sites-overview">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />{t('sites_overview')}
              </CardTitle>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary text-xs">
                  Manage Sites <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sitesOverview.map((site: any) => (
                <div key={site.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors" data-testid={`card-site-${site.id}`}>
                  <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0"><Building2 className="w-4 h-4 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{site.name}</p>
                    {site.city && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {site.city}</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><UserCheck className="w-3 h-3" /> {t('site_members', { count: site.memberCount })}</p>
                  </div>
                  <Badge variant={site.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0">{site.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-md border-border/50" data-testid="card-recent-orders">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold">Recent Orders</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : latestOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No orders yet.</div>
            ) : (
              <div className="space-y-1">
                {latestOrders.map((order: any) => (
                  <div key={order.id} className="group flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border/50" data-testid={`row-order-${order.id}`}>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{order.customer?.name || `Order #${order.id}`}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={order.status} />
                      <span className="font-mono text-sm font-medium w-20 text-right">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-md border-border/50" data-testid="card-orders-status-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Orders by Status</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              {orderStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderStatusData} cx="50%" cy="45%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                      {orderStatusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No order data</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md bg-primary/5 border-primary/10">
            <CardHeader><CardTitle className="text-base font-bold text-primary">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Link href="/customers">
                <Button variant="outline" className="w-full justify-start bg-background hover:bg-white hover:text-primary hover:border-primary/30 transition-all" data-testid="button-add-customer">
                  <Users className="w-4 h-4 mr-2" /> Add Customer
                </Button>
              </Link>
              <Link href="/expenses">
                <Button variant="outline" className="w-full justify-start bg-background hover:bg-white hover:text-primary hover:border-primary/30 transition-all" data-testid="button-log-expense">
                  <DollarSign className="w-4 h-4 mr-2" /> Log Expense
                </Button>
              </Link>
              {isOwner && (
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-start bg-background hover:bg-white hover:text-primary hover:border-primary/30 transition-all" data-testid="button-manage-sites">
                    <Building2 className="w-4 h-4 mr-2" /> Manage Sites
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {readyForPickup.length > 0 && (
        <Card className="shadow-md border-border/50" data-testid="card-ready-for-pickup">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-500" /> {t('ready_for_pickup')}
              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{readyForPickup.length}</Badge>
            </CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary text-xs">
                View All <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {readyForPickup.slice(0, 5).map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/20 rounded-lg" data-testid={`row-ready-${order.id}`}>
                  <div>
                    <p className="font-medium">{order.customer?.name || `Order #${order.id}`}</p>
                    <p className="text-xs text-muted-foreground">#{order.id} · {symbol}{Number(order.totalAmount).toFixed(2)}</p>
                  </div>
                  <Link href={`/orders/${order.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, ...props }: any) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  };
  return (
    <Card className="shadow-sm border-border/50 hover:shadow-md transition-all duration-300" {...props}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={`p-1.5 rounded-lg ${colorMap[color] || colorMap.blue}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold font-display">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div><Skeleton className="h-10 w-32" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><Skeleton className="lg:col-span-2 h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );
}
