import { useStats } from "@/hooks/use-stats";
import { useOrders } from "@/hooks/use-orders";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { 
  ArrowUpRight, ShoppingBag, Users, DollarSign, Clock, ChevronRight, Plus,
  AlertCircle, AlertTriangle, Info, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";

const STATUS_COLORS = ["#3b82f6", "#f97316", "#10b981", "#8b5cf6"];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: recentOrders, isLoading: ordersLoading } = useOrders();
  const { data: dashData } = useQuery<any>({ queryKey: ["/api/analytics/dashboard"] });
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const latestOrders = recentOrders?.slice().sort((a: any, b: any) => b.id - a.id).slice(0, 5) || [];

  if (statsLoading) return <DashboardSkeleton />;

  const alerts = dashData?.alerts || [];
  const targetPct = dashData?.targetAchievement || 0;
  const targetColor = targetPct >= 100 ? "bg-green-500" : targetPct >= 60 ? "bg-yellow-500" : "bg-red-500";

  const orderStatusData = dashData?.ordersByStatus ? [
    { name: "Received", value: dashData.ordersByStatus.received },
    { name: "Washing", value: dashData.ordersByStatus.washing },
    { name: "Ready", value: dashData.ordersByStatus.ready },
    { name: "Delivered", value: dashData.ordersByStatus.delivered },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-dashboard-title">{t('dashboard')}</h1>
          <p className="text-muted-foreground mt-1">{t('welcome')}! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/orders">
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all" data-testid="button-new-order">
              <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
            </Button>
          </Link>
        </div>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('total_revenue')} value={`${symbol}${stats?.totalRevenue.toFixed(2) || "0.00"}`} icon={DollarSign} trend="+12% from last month"
          className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-card" />
        <StatsCard title={t('total_orders')} value={stats?.totalOrders || 0} icon={ShoppingBag} trend="+5 new today" />
        <StatsCard title={t('pending_orders')} value={stats?.pendingOrders || 0} icon={Clock} trend="Requires attention"
          className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-card" />
        <StatsCard title={t('active_customers')} value={stats?.activeCustomers || 0} icon={Users} trend="+3 this week" />
      </div>

      {dashData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="shadow-sm" data-testid="card-daily-target">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t("daily_target")}</span>
                <Target className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${targetColor} rounded-full transition-all`} style={{ width: `${Math.min(100, targetPct)}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">{targetPct.toFixed(0)}% — {dashData.todayOrders} / {dashData.dailyTarget} orders</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm" data-testid="card-cost-per-kg">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t("cost_per_kg")}</p>
              <p className="text-2xl font-bold font-display mt-1">{symbol}{(dashData.costPerKg || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm" data-testid="card-profit-per-kg">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t("profit_per_kg")}</p>
              <p className={`text-2xl font-bold font-display mt-1 ${dashData.profitPerKg >= 0 ? "text-green-600" : "text-red-600"}`}>
                {symbol}{(dashData.profitPerKg || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-md border-border/50" data-testid="card-revenue-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">{t("revenue")} (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashData?.revenueByDay?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashData.revenueByDay}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${symbol}${v.toFixed(2)}`, t("revenue")]} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No revenue data</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50" data-testid="card-orders-status-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {orderStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                    {orderStatusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No order data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {dashData?.kgByDay && (
        <Card className="shadow-md border-border/50" data-testid="card-kg-chart">
          <CardHeader className="pb-2"><CardTitle className="text-lg font-bold">kg Processed (30 days)</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashData.kgByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
          <Card className="shadow-md bg-primary/5 border-primary/10">
            <CardHeader><CardTitle className="text-lg font-bold text-primary">Quick Actions</CardTitle></CardHeader>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, className }: any) {
  return (
    <Card className={`shadow-sm hover:shadow-md transition-all duration-300 border-border/50 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="bg-primary/10 p-2 rounded-lg text-primary"><Icon className="h-4 w-4" /></div>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold font-display tracking-tight">{value}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-green-500" /><span className="text-green-600 font-medium">{trend}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-8">
      <div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div><Skeleton className="h-10 w-32" /></div>
      <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      <div className="grid grid-cols-3 gap-8"><Skeleton className="col-span-2 h-96 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
    </div>
  );
}
