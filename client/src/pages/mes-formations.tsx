import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const api = "/api/consulting-pilot";
type Course = {
  title: string;
  amount: number;
  checkoutAmount: number;
  status: "UNPAID" | "PENDING" | "FAILED" | "CANCELLED" | "EXPIRED" | "COMPLETED";
  verificationDelayed: boolean;
  lastAttemptFailed: boolean;
  themes: { id: string; title: string; lessons: { id: string; title: string }[] }[];
};

const francs = new Intl.NumberFormat("fr-FR");
function formatPrice(amount: number) {
  return francs.format(amount) + " FCFA";
}

export default function MyCourses() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);
  const queryKey = [api, user?.id];
  const course = useQuery<Course>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", api)).json(),
    enabled: !!user,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: q => q.state.data?.status === "PENDING" ? 15000 : false,
  });
  const payment = useMutation({
    mutationFn: async () => (await apiRequest("POST", api + "/checkout")).json(),
    onSuccess: async result => {
      if (result.redirectUrl) window.location.assign(result.redirectUrl);
      else {
        setReviewOpen(false);
        await cache.invalidateQueries({ queryKey });
      }
    },
  });
  const data = course.data;
  const lessonCount = data?.themes.reduce((sum, theme) => sum + theme.lessons.length, 0);
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <h1 className="text-3xl font-bold">Mes formations</h1>
    {course.isLoading && <p role="status">Chargement…</p>}
    {course.isError && <p role="alert">Chargement impossible. <button className="underline" onClick={() => course.refetch()}>Réessayer</button></p>}
    {data && <section className="space-y-4 rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{data.status === "COMPLETED" ? "Formation débloquée · Paiement de test confirmé" : "Formation disponible à l’achat"}</p>
      <h2 className="text-xl font-semibold">{data.title}</h2>
      <p>{data.themes.length} thèmes · {lessonCount} leçons</p>
      <p><strong>{formatPrice(data.amount)}</strong> · Paiement unique pour toute la formation</p>
      {data.status === "PENDING" && <p role="status">{data.lastAttemptFailed ? "Votre tentative a été refusée. Vous pouvez réessayer avec le même lien." : "Votre paiement est en attente. Vous pouvez revenir sur cette page pour retrouver le résultat."}</p>}
      {data.status === "FAILED" && <p role="status">Le paiement a été refusé. Vous pouvez réessayer.</p>}
      {data.status === "EXPIRED" && <p role="status">Le lien de paiement a expiré. Vous pouvez en demander un nouveau.</p>}
      {data.status === "CANCELLED" && <p role="status">Le paiement a été annulé.</p>}
      {data.verificationDelayed && <p role="status">La vérification auprès de pawaPay reprend dans quelques instants.</p>}
      {data.status !== "COMPLETED" && <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogTrigger asChild><Button>{data.status === "PENDING" ? "Reprendre le paiement de test" : "Acheter la formation"}</Button></DialogTrigger>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Récapitulatif de votre achat</DialogTitle>
            <DialogDescription>Paiement unique par Mobile Money · pawaPay Sandbox</DialogDescription>
          </DialogHeader>
          <div>
            <p className="font-semibold">{data.title}</p>
            <p>{data.themes.length} thèmes · {lessonCount} leçons</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span>Total à payer</span><strong>{formatPrice(data.checkoutAmount)}</strong>
          </div>
          {data.checkoutAmount !== data.amount && <p>Ce lien de test conserve le tarif auquel il a été créé.</p>}
          <p className="text-sm text-muted-foreground">Vous allez ouvrir la page de test Mobile Money. Aucun débit réel.</p>
          {payment.isError && <p role="alert">La page de paiement est indisponible. Réessayez dans quelques instants.</p>}
          <DialogFooter>
            <Button disabled={payment.isPending} onClick={() => payment.mutate()}>
              {payment.isPending ? "Ouverture…" : "Continuer vers Mobile Money"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
      <div className="divide-y border-t">{data.themes.map(theme =>
        <details key={theme.id} className="py-1">
          <summary className="cursor-pointer py-3 font-medium">
            {theme.title} <span className="text-sm text-muted-foreground">({theme.lessons.length})</span>
          </summary>
          <ol className="list-decimal space-y-2 pb-3 pl-7">{theme.lessons.map(lesson =>
            <li key={lesson.id}>{data.status === "COMPLETED"
              ? <a href={api + "/modules/" + lesson.id} target="_blank" rel="noreferrer" className="inline-block py-1 font-medium text-primary underline">{lesson.title}</a>
              : lesson.title}</li>)}</ol>
        </details>)}</div>
    </section>}
  </main>;
}
