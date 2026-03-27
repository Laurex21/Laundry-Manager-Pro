import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useOrder, useUpdateOrderStatus } from "@/hooks/use-orders";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle2, Clock, Droplets, Wind, Shirt, Sparkles, Package, Truck,
  AlertTriangle, RotateCcw, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { generateDepositReceipt } from "@/lib/receipt";

const PIPELINE_STAGES = [
  { key: "received", label: "Received", icon: Package, color: "text-yellow-600" },
  { key: "washing", label: "Washing", icon: Droplets, color: "text-blue-600" },
  { key: "stain_treatment", label: "Stain Treatment", icon: Sparkles, color: "text-amber-600" },
  { key: "drying", label: "Drying", icon: Wind, color: "text-cyan-600" },
  { key: "ironing", label: "Ironing", icon: Shirt, color: "text-violet-600" },
  { key: "ready", label: "Ready", icon: CheckCircle2, color: "text-indigo-600" },
  { key: "delivered", label: "Delivered", icon: Truck, color: "text-green-600" },
];

function getStageIndex(status: string): number {
  const idx = PIPELINE_STAGES.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const orderId = Number(params?.id);
  const { data: order, isLoading } = useOrder(orderId);
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { toast } = useToast();

  const [returnGarmentId, setReturnGarmentId] = useState<number | null>(null);
  const [returnStage, setReturnStage] = useState("washing");
  const [returnNotes, setReturnNotes] = useState("");

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading order...</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Order not found</p>
        <Link href="/orders"><Button variant="outline">Back to Orders</Button></Link>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(order.status);
  const hasReturnedItems = order.garmentItems?.some((g: any) => g.returnedForTreatment && !g.resolvedAt);

  function handleAdvanceStatus() {
    const nextStage = PIPELINE_STAGES[currentStageIndex + 1];
    if (!nextStage) return;
    updateStatus({ id: orderId, status: nextStage.key });
  }

  function handleSetStatus(status: string) {
    updateStatus({ id: orderId, status });
  }

  async function handleMarkReturned() {
    if (!returnGarmentId) return;
    try {
      const res = await fetch(`/api/garment-items/${returnGarmentId}/return`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnStage, returnNotes }),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Garment flagged", description: "Garment marked for return treatment" });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        setReturnGarmentId(null);
        setReturnNotes("");
      }
    } catch {
      toast({ title: "Error", description: "Failed to flag garment", variant: "destructive" });
    }
  }

  async function handleResolveReturn(garmentId: number) {
    try {
      const res = await fetch(`/api/garment-items/${garmentId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Resolved", description: "Garment return resolved" });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
      }
    } catch {
      toast({ title: "Error", description: "Failed to resolve", variant: "destructive" });
    }
  }

  function handleDownloadReceipt() {
    generateDepositReceipt(order, symbol);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon" data-testid="button-back-orders">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">Order #{order.id}</h1>
          <p className="text-muted-foreground text-sm">
            {order.customer?.name} &bull; {order.entryDate ? format(new Date(order.entryDate), "MMM d, yyyy") : "N/A"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadReceipt} data-testid="button-download-deposit-receipt">
            <Download className="w-4 h-4 mr-2" /> Receipt
          </Button>
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {hasReturnedItems && (
        <Card className="border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/10" data-testid="returned-items-alert">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-semibold text-orange-800 dark:text-orange-300">Incomplete Order</p>
              <p className="text-sm text-orange-700 dark:text-orange-400">Some garments have been returned for additional treatment.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden" data-testid="pipeline-stepper">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const isPast = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                        isPast ? "bg-green-100 border-green-500 text-green-600 dark:bg-green-900/30" :
                        isCurrent ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/20" :
                        "bg-muted border-border text-muted-foreground"
                      )}
                    >
                      {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium text-center leading-tight",
                      isCurrent ? "text-primary font-bold" : isPast ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Current</span>
                    )}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 min-w-[20px] mx-1",
                      i < currentStageIndex ? "bg-green-500" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            {currentStageIndex < PIPELINE_STAGES.length - 1 && (
              <Button
                size="sm"
                onClick={handleAdvanceStatus}
                disabled={isUpdating}
                data-testid="button-advance-status"
              >
                Advance to {PIPELINE_STAGES[currentStageIndex + 1]?.label}
              </Button>
            )}
            <Select onValueChange={handleSetStatus}>
              <SelectTrigger className="w-[180px] h-9" data-testid="select-set-status">
                <SelectValue placeholder="Jump to stage..." />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{item.service?.name}</span>
                    <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                  </div>
                  <span className="font-mono font-semibold">{symbol}{(Number(item.priceAtOrder) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {Number(order.discount) > 0 && (
                <div className="flex justify-between items-center p-2 text-sm text-red-600">
                  <span>Discount</span>
                  <span className="font-mono">-{symbol}{Number(order.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg font-bold">
                <span>Total</span>
                <span className="font-mono text-primary">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Garment Checklist
              {hasReturnedItems && <Badge variant="outline" className="border-orange-300 text-orange-600">Returns Pending</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.garmentItems?.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No garment items recorded</p>
            ) : (
              <div className="space-y-2">
                {order.garmentItems?.map((g: any) => (
                  <div key={g.id} className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-sm",
                    g.returnedForTreatment && !g.resolvedAt ? "bg-orange-50 dark:bg-orange-950/10 border border-orange-200" : "bg-muted/30"
                  )} data-testid={`garment-item-${g.id}`}>
                    <div className="flex items-center gap-2">
                      <span>{g.quantity}x {g.itemName}</span>
                      {g.returnedForTreatment && !g.resolvedAt && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                          <RotateCcw className="w-3 h-3 mr-1" /> Returned: {g.returnStage}
                        </Badge>
                      )}
                      {g.resolvedAt && (
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-600">Resolved</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {g.returnedForTreatment && !g.resolvedAt ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleResolveReturn(g.id)} data-testid={`button-resolve-${g.id}`}>
                          Resolve
                        </Button>
                      ) : !g.resolvedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-orange-600"
                          onClick={() => setReturnGarmentId(g.id)}
                          data-testid={`button-return-${g.id}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Return
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {returnGarmentId && (
              <div className="mt-4 p-3 border rounded-lg bg-muted/20 space-y-3" data-testid="return-form">
                <p className="text-sm font-medium">Flag garment for return treatment</p>
                <Select value={returnStage} onValueChange={setReturnStage}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="washing">Re-wash</SelectItem>
                    <SelectItem value="stain_treatment">Stain Treatment</SelectItem>
                    <SelectItem value="ironing">Re-iron</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Notes (optional)"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  data-testid="input-return-notes"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleMarkReturned} data-testid="button-confirm-return">Confirm Return</Button>
                  <Button size="sm" variant="outline" onClick={() => setReturnGarmentId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {order.statusHistory && order.statusHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.statusHistory.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm p-2 bg-muted/20 rounded">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <StatusBadge status={entry.status} />
                  <span className="text-muted-foreground">{entry.changedAt ? format(new Date(entry.changedAt), "MMM d, yyyy h:mm a") : ""}</span>
                  {entry.notes && <span className="text-muted-foreground italic">- {entry.notes}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent>
          {order.payments?.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No payments recorded yet</p>
          ) : (
            <div className="space-y-2">
              {order.payments?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.method}</span>
                    {p.reference && <span className="text-xs text-muted-foreground">Ref: {p.reference}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-green-600">{symbol}{Number(p.amount).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{p.date ? format(new Date(p.date), "MMM d") : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
