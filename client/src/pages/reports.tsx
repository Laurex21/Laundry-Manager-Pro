import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Download,
  CalendarIcon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 197 37% 24%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
  "hsl(220 70% 55%)",
  "hsl(280 60% 55%)",
  "hsl(340 70% 55%)",
];

type ReportData = {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalOrders: number;
  dailyRevenue: { date: string; revenue: number }[];
  serviceDistribution: { name: string; count: number }[];
  topCustomers: { name: string; orderCount: number; totalSpent: number }[];
};

type PerformanceData = {
  currentMonthRevenue: number;
  currentMonthExpenses: number;
  currentMonthProfit: number;
  last30Revenue: number;
  prev30Revenue: number;
  last30Expenses: number;
  prev30Expenses: number;
  last30Profit: number;
  prev30Profit: number;
  monthlyComparison: { month: string; income: number; expenses: number }[];
};

export default function Reports() {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const queryParams = useMemo(() => {
    const start = format(dateFrom, "yyyy-MM-dd");
    const end = format(dateTo, "yyyy-MM-dd");
    return { start, end };
  }, [dateFrom, dateTo]);

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: [`/api/reports?start=${queryParams.start}&end=${queryParams.end}`],
  });

  const { data: perfData, isLoading: perfLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/reports/performance"],
  });

  const alerts = useMemo(() => {
    if (!perfData) return [];
    const result: { type: "warning" | "danger" | "success"; message: string }[] = [];

    if (perfData.prev30Expenses > 0) {
      const expChange = ((perfData.last30Expenses - perfData.prev30Expenses) / perfData.prev30Expenses) * 100;
      if (expChange > 5) {
        result.push({ type: "warning", message: t("alert_spending_increase", { percent: Math.round(expChange) }) });
      }
    } else if (perfData.last30Expenses > 0) {
      result.push({ type: "warning", message: t("alert_spending_increase", { percent: 100 }) });
    }

    if (perfData.prev30Revenue > 0) {
      const revChange = ((perfData.last30Revenue - perfData.prev30Revenue) / perfData.prev30Revenue) * 100;
      if (revChange < -5) {
        result.push({ type: "danger", message: t("notice_revenue_decrease", { percent: Math.abs(Math.round(revChange)) }) });
      }
    }

    if (perfData.prev30Profit !== 0) {
      const profitChange = perfData.prev30Profit !== 0
        ? ((perfData.last30Profit - perfData.prev30Profit) / Math.abs(perfData.prev30Profit)) * 100
        : 0;
      if (profitChange > 5) {
        result.push({ type: "success", message: t("notice_profit_growth", { percent: Math.round(profitChange) }) });
      }
    }

    return result;
  }, [perfData, t]);

  function handleDownloadReport() {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`CleanEase - ${t("monthly_report")}`);
    lines.push(`${t("period")}: ${format(dateFrom, "MMM d, yyyy")} - ${format(dateTo, "MMM d, yyyy")}`);
    lines.push("");
    lines.push(`--- ${t("summary")} ---`);
    lines.push(`${t("total_revenue")}: ${symbol}${data.totalRevenue.toFixed(2)}`);
    lines.push(`${t("total_expenses_label")}: ${symbol}${data.totalExpenses.toFixed(2)}`);
    lines.push(`${t("net_profit")}: ${symbol}${data.netProfit.toFixed(2)}`);
    lines.push(`${t("number_of_orders")}: ${data.totalOrders}`);
    lines.push("");
    lines.push(`--- ${t("daily_revenue_trend")} ---`);
    for (const d of data.dailyRevenue) {
      lines.push(`${d.date}: ${symbol}${d.revenue.toFixed(2)}`);
    }
    lines.push("");
    lines.push(`--- ${t("service_distribution")} ---`);
    for (const s of data.serviceDistribution) {
      lines.push(`${s.name}: ${s.count} ${t("bookings")}`);
    }
    lines.push("");
    lines.push(`--- ${t("top_customers")} ---`);
    lines.push(`${t("name")} | ${t("order_count")} | ${t("total_spent")}`);
    for (const c of data.topCustomers) {
      lines.push(`${c.name} | ${c.orderCount} | ${symbol}${c.totalSpent.toFixed(2)}`);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CleanEase_Report_${queryParams.start}_${queryParams.end}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const formattedDailyRevenue = useMemo(() => {
    if (!data?.dailyRevenue) return [];
    return data.dailyRevenue.map((d) => ({
      ...d,
      label: format(new Date(d.date + "T00:00:00"), "MMM d"),
    }));
  }, [data?.dailyRevenue]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-reports-title">
            {t("reports_analytics")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("reports_subtitle")}</p>
        </div>
        <Button
          onClick={handleDownloadReport}
          disabled={!data || isLoading}
          className="shadow-lg shadow-primary/25"
          data-testid="button-download-report"
        >
          <Download className="w-4 h-4 mr-2" />
          {t("download_monthly_report")}
        </Button>
      </div>

      <Card data-testid="card-date-filter">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">{t("date_range")}:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <DatePickerButton
                date={dateFrom}
                onSelect={setDateFrom}
                label={t("from")}
                testId="button-date-from"
              />
              <span className="text-muted-foreground">—</span>
              <DatePickerButton
                date={dateTo}
                onSelect={setDateTo}
                label={t("to")}
                testId="button-date-to"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={t("total_revenue")}
            value={`${symbol}${(data?.totalRevenue ?? 0).toFixed(2)}`}
            icon={DollarSign}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            testId="card-metric-revenue"
          />
          <MetricCard
            title={t("total_expenses_label")}
            value={`${symbol}${(data?.totalExpenses ?? 0).toFixed(2)}`}
            icon={TrendingDown}
            iconColor="text-red-600 dark:text-red-400"
            iconBg="bg-red-100 dark:bg-red-900/30"
            testId="card-metric-expenses"
          />
          <MetricCard
            title={t("net_profit")}
            value={`${symbol}${(data?.netProfit ?? 0).toFixed(2)}`}
            icon={TrendingUp}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            testId="card-metric-profit"
          />
          <MetricCard
            title={t("number_of_orders")}
            value={String(data?.totalOrders ?? 0)}
            icon={ShoppingBag}
            iconColor="text-violet-600 dark:text-violet-400"
            iconBg="bg-violet-100 dark:bg-violet-900/30"
            testId="card-metric-orders"
          />
        </div>
      )}

      <Card data-testid="card-performance-monitor">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {t("performance_monitor")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t("performance_subtitle")}</p>
          </div>
          {perfData && (
            <Badge
              variant={perfData.currentMonthProfit >= 0 ? "default" : "destructive"}
              className="text-sm"
              data-testid="badge-profitability-status"
            >
              {perfData.currentMonthProfit >= 0 ? t("status_profitable") : t("status_loss_making")}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {perfLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ) : perfData ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("current_month_profit")}</p>
                  <p
                    className={cn(
                      "text-3xl font-bold font-mono",
                      perfData.currentMonthProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}
                    data-testid="text-current-month-profit"
                  >
                    {perfData.currentMonthProfit >= 0 ? "+" : ""}{symbol}{perfData.currentMonthProfit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("revenue")}: {symbol}{perfData.currentMonthRevenue.toFixed(2)} &middot; {t("expenses")}: {symbol}{perfData.currentMonthExpenses.toFixed(2)}
                  </p>
                </div>
              </div>

              {(alerts.length > 0 || (!perfLoading && perfData)) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("smart_trend_notifications")}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{t("vs_previous_30_days")}</p>
                  <div className="space-y-2">
                    {alerts.length === 0 ? (
                      <Card>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted flex-shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid="text-no-alerts">{t("no_alerts")}</p>
                        </CardContent>
                      </Card>
                    ) : (
                      alerts.map((alert, idx) => (
                        <Card key={idx} data-testid={`card-alert-${idx}`}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
                              alert.type === "warning" ? "bg-amber-100 dark:bg-amber-900/30" :
                              alert.type === "danger" ? "bg-red-100 dark:bg-red-900/30" :
                              "bg-emerald-100 dark:bg-emerald-900/30"
                            )}>
                              {alert.type === "warning" ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              ) : alert.type === "danger" ? (
                                <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </div>
                            <p className={cn(
                              "text-sm",
                              alert.type === "warning" ? "text-amber-700 dark:text-amber-300" :
                              alert.type === "danger" ? "text-red-700 dark:text-red-300" :
                              "text-emerald-700 dark:text-emerald-300"
                            )} data-testid={`text-alert-${idx}`}>
                              {alert.message}
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-1">{t("income_vs_expenses")}</h4>
                <p className="text-xs text-muted-foreground mb-3">{t("income_vs_expenses_subtitle")}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={perfData.monthlyComparison} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `${symbol}${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      formatter={(value: number, name: string) => [
                        `${symbol}${value.toFixed(2)}`,
                        name === "income" ? t("income") : t("expenses"),
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                      formatter={(value) => value === "income" ? t("income") : t("expenses")}
                    />
                    <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" data-testid="card-daily-revenue-chart">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-semibold">{t("daily_revenue_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : formattedDailyRevenue.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                {t("no_data_for_period")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <LineChart data={formattedDailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => `${symbol}${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [`${symbol}${value.toFixed(2)}`, t("revenue")]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-service-distribution-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("service_distribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : !data?.serviceDistribution?.length ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                {t("no_data_for_period")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={data.serviceDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                  >
                    {data.serviceDistribution.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} ${t("bookings")}`,
                      name,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-top-customers">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{t("top_customers")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : !data?.topCustomers?.length ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {t("no_data_for_period")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead className="text-center">{t("order_count")}</TableHead>
                    <TableHead className="text-right">{t("total_spent")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topCustomers.map((c, idx) => (
                    <TableRow key={idx} data-testid={`row-top-customer-${idx}`}>
                      <TableCell className="font-medium" data-testid={`text-customer-name-${idx}`}>
                        {c.name}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-customer-orders-${idx}`}>
                        {c.orderCount}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-customer-spent-${idx}`}>
                        {symbol}{c.totalSpent.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  testId,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold font-mono mt-1 truncate" data-testid={`${testId}-value`}>
              {value}
            </p>
          </div>
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DatePickerButton({
  date,
  onSelect,
  label,
  testId,
}: {
  date: Date;
  onSelect: (d: Date) => void;
  label: string;
  testId: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start text-left font-normal min-w-[160px]"
          data-testid={testId}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {format(date, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) onSelect(d);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
