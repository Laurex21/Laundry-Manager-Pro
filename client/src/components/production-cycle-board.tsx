import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Activity, ArrowRight, Play, Plus, Square, Trash2, WashingMachine } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useOrders } from "@/hooks/use-orders";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Machine } from "@shared/schema";

type CycleOrder = {
  id: number;
  orderId: number;
  customerName: string;
  weightKg: string;
  status: string;
};

type ProductionCycle = {
  id: number;
  machineId: number;
  machineName: string;
  stage: "washing" | "drying";
  status: "preparing" | "running";
  capacityKg: string;
  totalWeightKg: string;
  plannedDurationMinutes: number;
  startedAt: string | null;
  orders: CycleOrder[];
};

export function ProductionCycleBoard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"washing" | "drying">("washing");
  const [machineId, setMachineId] = useState("");
  const [duration, setDuration] = useState("45");
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: cycles = [], isError } = useQuery<ProductionCycle[]>({ queryKey: ["/api/production-cycles"] });
  const { data: orders = [] } = useOrders();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/production-cycles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/decision-cockpit"] });
  };

  const createCycle = useMutation({
    mutationFn: () => apiRequest("POST", "/api/production-cycles", {
      machineId: Number(machineId),
      stage,
      plannedDurationMinutes: Number(duration),
    }),
    onSuccess: () => {
      refresh();
      setMachineId("");
      toast({ title: t("cycle_created") });
    },
    onError: (error: Error) => toast({ title: t("error"), description: error.message, variant: "destructive" }),
  });

  const eligibleMachines = machines.filter((machine) =>
    machine.status === "active" && machine.type === (stage === "washing" ? "washer" : "dryer"),
  );

  return (
    <section aria-labelledby="production-cycles-title" className="space-y-4" data-testid="section-production-cycles">
      <div>
        <h2 id="production-cycles-title" className="text-xl font-bold font-display">{t("production_cycles")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("production_cycles_help")}</p>
      </div>

      <Card className="border-cyan-200 bg-cyan-50/40 dark:border-cyan-900 dark:bg-cyan-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WashingMachine className="h-4 w-4" aria-hidden="true" />
            {t("prepare_cycle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (machineId) createCycle.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cycle-stage">{t("production_stage")}</Label>
              <Select value={stage} onValueChange={(value: "washing" | "drying") => { setStage(value); setMachineId(""); }}>
                <SelectTrigger id="cycle-stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="washing">{t("stage_washing")}</SelectItem>
                  <SelectItem value="drying">{t("stage_drying")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-machine">{t("machine")}</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger id="cycle-machine"><SelectValue placeholder={t("select_machine")} /></SelectTrigger>
                <SelectContent>
                  {eligibleMachines.map((machine) => (
                    <SelectItem key={machine.id} value={String(machine.id)}>
                      {machine.name} · {Number(machine.capacityKg).toLocaleString()} kg
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-duration">{t("planned_duration_minutes")}</Label>
              <Input id="cycle-duration" type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
            </div>
            <Button type="submit" className="min-h-11" disabled={!machineId || createCycle.isPending}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("prepare_cycle")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isError ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {t("production_cycles_migration_required")}
        </p>
      ) : cycles.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {cycles.map((cycle) => (
            <ProductionCycleCard key={cycle.id} cycle={cycle} orders={orders as any[]} onChanged={refresh} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Activity className="mx-auto mb-2 h-6 w-6 opacity-50" aria-hidden="true" />
          {t("no_active_cycles")}
        </div>
      )}
    </section>
  );
}

function ProductionCycleCard({ cycle, orders, onChanged }: { cycle: ProductionCycle; orders: any[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [orderId, setOrderId] = useState("");
  const [weight, setWeight] = useState("");
  const capacity = Number(cycle.capacityKg);
  const total = Number(cycle.totalWeightKg);
  const percentage = capacity > 0 ? Math.min(100, (total / capacity) * 100) : 0;
  const candidateStatuses = cycle.stage === "washing" ? ["received", "stain_treatment"] : ["washing"];
  const includedIds = new Set(cycle.orders.map((order) => order.orderId));
  const candidates = orders.filter((order) => candidateStatuses.includes(order.status) && !includedIds.has(order.id));

  const mutation = useMutation({
    mutationFn: async ({ action, targetOrderId }: { action: "add" | "remove" | "start" | "complete"; targetOrderId?: number }) => {
      if (action === "add") return apiRequest("POST", `/api/production-cycles/${cycle.id}/orders`, { orderId: Number(orderId), weightKg: Number(weight) });
      if (action === "remove") return apiRequest("DELETE", `/api/production-cycles/${cycle.id}/orders/${targetOrderId}`);
      return apiRequest("POST", `/api/production-cycles/${cycle.id}/${action}`);
    },
    onSuccess: (_, variables) => {
      onChanged();
      setOrderId("");
      setWeight("");
      toast({ title: t(`cycle_${variables.action}_success`) });
    },
    onError: (error: Error) => toast({ title: t("error"), description: error.message, variant: "destructive" }),
  });

  return (
    <Card className={cycle.status === "running" ? "border-emerald-300 dark:border-emerald-900" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{cycle.machineName}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t(`stage_${cycle.stage}`)} · {cycle.plannedDurationMinutes} min</p>
          </div>
          <Badge variant={cycle.status === "running" ? "default" : "secondary"}>{t(`cycle_status_${cycle.status}`)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>{t("machine_load")}</span>
            <strong className="font-mono">{total.toLocaleString()} / {capacity.toLocaleString()} kg · {percentage.toFixed(0)}%</strong>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t("machine_load")} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={total}>
            <div className={`h-full rounded-full ${percentage >= 85 ? "bg-emerald-600" : percentage >= 50 ? "bg-cyan-600" : "bg-amber-500"}`} style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {percentage < 50 ? t("cycle_load_low") : percentage <= 85 ? t("cycle_load_good") : t("cycle_load_optimal")}
          </p>
        </div>

        <ul className="divide-y rounded-lg border">
          {cycle.orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <strong>#{order.orderId}</strong>
                <span className="ml-2 text-muted-foreground">{order.customerName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono">{Number(order.weightKg).toLocaleString()} kg</span>
                {cycle.status === "preparing" && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => mutation.mutate({ action: "remove", targetOrderId: order.orderId })} aria-label={t("remove_order_from_cycle")}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {cycle.status === "preparing" ? (
          <>
            <form className="grid gap-3 sm:grid-cols-[1fr_110px_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); if (orderId && weight) mutation.mutate({ action: "add" }); }}>
              <div className="space-y-2">
                <Label htmlFor={`cycle-order-${cycle.id}`}>{t("add_order_to_cycle")}</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger id={`cycle-order-${cycle.id}`}><SelectValue placeholder={t("select_order")} /></SelectTrigger>
                  <SelectContent>
                    {candidates.map((order) => <SelectItem key={order.id} value={String(order.id)}>#{order.id} · {order.customer?.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`cycle-weight-${cycle.id}`}>{t("weight_kg")}</Label>
                <Input id={`cycle-weight-${cycle.id}`} type="number" min="0.01" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} />
              </div>
              <Button type="submit" variant="outline" className="min-h-11" disabled={!orderId || !weight || mutation.isPending}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t("add_order_to_cycle")}</span>
              </Button>
            </form>
            <Button className="min-h-11 w-full" disabled={!cycle.orders.length || mutation.isPending} onClick={() => mutation.mutate({ action: "start" })}>
              <Play className="mr-2 h-4 w-4" aria-hidden="true" /> {t("start_cycle")}
            </Button>
          </>
        ) : (
          <Button className="min-h-11 w-full" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "complete" })}>
            <Square className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("complete_cycle")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
