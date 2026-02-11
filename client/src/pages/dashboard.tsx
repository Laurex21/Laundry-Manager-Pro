import { useStats } from "@/hooks/use-stats";
import { useOrders } from "@/hooks/use-orders";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { 
  ArrowUpRight, 
  ShoppingBag, 
  Users, 
  DollarSign, 
  Clock, 
  ChevronRight,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: recentOrders, isLoading: ordersLoading } = useOrders();
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  // Sort orders by id desc to get recent ones, take top 5
  const latestOrders = recentOrders?.slice().sort((a: any, b: any) => b.id - a.id).slice(0, 5) || [];

  if (statsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('dashboard')}</h1>
          <p className="text-muted-foreground mt-1">{t('welcome')}! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/orders">
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title={t('total_revenue')} 
          value={`${symbol}${stats?.totalRevenue.toFixed(2) || "0.00"}`} 
          icon={DollarSign} 
          trend="+12% from last month"
          className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-card"
        />
        <StatsCard 
          title={t('total_orders')} 
          value={stats?.totalOrders || 0} 
          icon={ShoppingBag} 
          trend="+5 new today"
        />
        <StatsCard 
          title={t('pending_orders')} 
          value={stats?.pendingOrders || 0} 
          icon={Clock} 
          trend="Requires attention"
          className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-card"
        />
        <StatsCard 
          title={t('active_customers')} 
          value={stats?.activeCustomers || 0} 
          icon={Users} 
          trend="+3 this week"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders Table */}
        <Card className="lg:col-span-2 shadow-md border-border/50">
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
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : latestOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No orders yet.</div>
            ) : (
              <div className="space-y-1">
                {latestOrders.map((order: any) => (
                  <div key={order.id} className="group flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border/50">
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

        {/* Quick Actions / Mini Catalog */}
        <div className="space-y-6">
          <Card className="shadow-md bg-primary/5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-primary">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/customers">
                <Button variant="outline" className="w-full justify-start bg-background hover:bg-white hover:text-primary hover:border-primary/30 transition-all">
                  <Users className="w-4 h-4 mr-2" /> Add Customer
                </Button>
              </Link>
              <Link href="/expenses">
                <Button variant="outline" className="w-full justify-start bg-background hover:bg-white hover:text-primary hover:border-primary/30 transition-all">
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
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold font-display tracking-tight">{value}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-green-500" />
            <span className="text-green-600 font-medium">{trend}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-8">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-8">
        <Skeleton className="col-span-2 h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
