import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Crown, Download, RefreshCw, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export function CustomerMembershipTab({ customerId }: { customerId: number }) {
  const { t } = useTranslation(); const { toast } = useToast();
  const key = ["customer-subscription", customerId];
  const { data: subscription, isLoading } = useQuery<any>({ queryKey: key, queryFn: async () => { const r = await fetch(`/api/customers/${customerId}/subscription`, { credentials: "include" }); if (!r.ok) throw new Error("Unable to load subscription"); return r.json(); } });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["/api/subscription-plans"] });
  const history = useQuery<any>({ queryKey: ["subscription-history", subscription?.id], queryFn: async () => { const r = await fetch(`/api/subscriptions/${subscription.id}/history`, { credentials: "include" }); if (!r.ok) throw new Error("Unable to load history"); return r.json(); }, enabled: !!subscription?.id });
  const card = useQuery<any>({ queryKey: ["membership-card", subscription?.id], queryFn: async () => { const r = await fetch(`/api/subscriptions/${subscription.id}/card`, { credentials: "include" }); if (!r.ok) throw new Error("Unable to load membership card"); return r.json(); }, enabled: !!subscription?.id });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: key }); queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] }); };
  const action = useMutation({ mutationFn: ({ url, method, body }: any) => apiRequest(method, url, body), onSuccess: refresh, onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) });
  const regenerateCard = useMutation({ mutationFn: async () => { const response = await apiRequest("POST", `/api/subscriptions/${subscription.id}/card/regenerate`); return response.json(); }, onSuccess: (data) => { queryClient.setQueryData(["membership-card", subscription.id], data); toast({ title: t("regenerate_card") }); }, onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) });
  if (isLoading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>;
  if (!subscription) return <Card><CardContent className="space-y-4 p-6"><div className="text-center"><Crown className="mx-auto mb-2 h-8 w-8 text-muted-foreground"/><h3 className="font-semibold">{t("no_subscription")}</h3><p className="text-sm text-muted-foreground">Choisissez un plan pour activer l’abonnement de ce client.</p></div><div className="grid gap-3 sm:grid-cols-2">{plans.filter(p=>p.status==="active").map(plan=><button key={plan.id} className="rounded-lg border p-4 text-left hover:bg-muted" onClick={()=>action.mutate({ method:"POST", url:`/api/customers/${customerId}/subscription`, body:{ subscriptionPlanId:plan.id,startDate:new Date().toISOString().slice(0,10),paymentMethod:"cash" } })}><p className="font-medium">{plan.name}</p><p className="text-sm text-muted-foreground">{Number(plan.recurringPrice).toLocaleString()} FCFA / {t(plan.billingCycle)}</p></button>)}</div></CardContent></Card>;
  const limits = [{ key:"Kg", remaining:subscription.remainingKg, total:subscription.plan.includedWeightKg },{ key:t("remaining_pieces"), remaining:subscription.remainingPieces, total:subscription.plan.includedPieces },{ key:t("remaining_orders"), remaining:subscription.remainingOrders, total:subscription.plan.maxOrders }].filter(x=>x.total!=null);
  const shareCard = () => {
    const firstName = String(subscription.customerName ?? "").split(" ")[0] || "client";
    const message = encodeURIComponent(`Bonjour ${firstName} ! 🎉\n\nVotre carte de membre ${subscription.plan.name} est prête.\n\nN° membre : ${subscription.membershipNumber}\nValable jusqu'au : ${new Date(`${subscription.expiryDate}T00:00:00`).toLocaleDateString()}\n\nPrésentez ce numéro à chaque visite.`);
    const phone = String(subscription.customerPhone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
  };
  return <div className="space-y-4">
    <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>{subscription.plan.name}</CardTitle><p className="text-sm text-muted-foreground">{subscription.membershipNumber}</p></div><Badge>{subscription.status}</Badge></div></CardHeader><CardContent className="space-y-5">{limits.map(x=><div key={x.key}><div className="mb-2 flex justify-between text-sm"><span>{x.key}</span><span>{x.remaining} / {x.total}</span></div><Progress value={Number(x.total)?Number(x.remaining)/Number(x.total)*100:0}/></div>)}<div className="grid gap-2 sm:grid-cols-2">{[["pickupIncluded",t("pickup_included")],["deliveryIncluded",t("delivery_included")],["expressIncluded",t("express_included")],["priorityQueue",t("priority_queue")]].filter(([k])=>subscription.plan[k]).map(([k,label])=><div key={String(k)} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-600" aria-hidden="true"/>{label}</div>)}</div><div className="flex flex-wrap gap-2"><Button onClick={()=>action.mutate({method:"POST",url:`/api/subscriptions/${subscription.id}/renew`,body:{paymentMethod:"cash"}})}>{t("renew_subscription")}</Button><Button variant="outline" onClick={()=>action.mutate({method:"PATCH",url:`/api/subscriptions/${subscription.id}/status`,body:{status:subscription.status==="suspended"?"active":"suspended"}})}>{subscription.status==="suspended"?"Réactiver":t("suspend_subscription")}</Button><Button variant="destructive" onClick={()=>action.mutate({method:"PATCH",url:`/api/subscriptions/${subscription.id}/status`,body:{status:"cancelled"}})}>{t("cancel_subscription")}</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>{t("membership_card")}</CardTitle></CardHeader><CardContent className="space-y-3">
      {card.isLoading ? <div className="aspect-[324/204] w-full max-w-sm animate-pulse rounded-xl bg-muted mx-auto" aria-label="Chargement de la carte" /> : card.data?.digitalCardImage ? <img src={card.data.digitalCardImage} alt={`${t("membership_card")} ${subscription.membershipNumber}`} className="w-full max-w-sm rounded-xl shadow-xl mx-auto" /> : <p className="text-center text-sm text-muted-foreground">Carte indisponible</p>}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button size="sm" variant="outline" asChild><a href={`/api/subscriptions/${subscription.id}/card/download`} download><Download className="w-4 h-4 mr-2" aria-hidden="true" />{t("download_card")}</a></Button>
        <Button size="sm" variant="outline" onClick={shareCard}><Share2 className="w-4 h-4 mr-2" aria-hidden="true" />{t("share_card")}</Button>
        <Button size="sm" variant="outline" disabled={regenerateCard.isPending} onClick={()=>regenerateCard.mutate()}><RefreshCw className={`w-4 h-4 mr-2 ${regenerateCard.isPending ? "animate-spin" : ""}`} aria-hidden="true" />{t("regenerate_card")}</Button>
      </div>
    </CardContent></Card>
    <Tabs defaultValue="usage"><TabsList><TabsTrigger value="usage">Utilisations</TabsTrigger><TabsTrigger value="payments">Paiements</TabsTrigger></TabsList><TabsContent value="usage"><Card><CardContent className="p-4 text-sm">{history.data?.transactions?.length ? history.data.transactions.map((x:any)=><div key={x.id} className="border-b py-2">{x.transactionDate} · {x.kgConsumed||0} kg · {x.piecesConsumed||0} pièces</div>) : "Aucune utilisation"}</CardContent></Card></TabsContent><TabsContent value="payments"><Card><CardContent className="p-4 text-sm">{(history.data?.payments||subscription.payments||[]).map((x:any)=><div key={x.id} className="flex justify-between border-b py-2"><span>{new Date(x.paymentDate).toLocaleDateString()}</span><span>{Number(x.amount).toLocaleString()} FCFA</span></div>)}</CardContent></Card></TabsContent></Tabs>
  </div>;
}
