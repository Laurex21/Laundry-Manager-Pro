import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const api = "/api/consulting-pilot";
type Course = {
  title: string;
  amount: number;
  status: "UNPAID" | "ACCEPTED" | "COMPLETED";
  checkoutId?: string;
  themes: { id: string; title: string; lessons: { id: string; title: string }[] }[];
};

export default function MyCourses() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const queryKey = [api, user?.id];
  const course = useQuery<Course>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", api)).json(),
    enabled: !!user,
  });
  const payment = useMutation({
    mutationFn: (path: string) => apiRequest("POST", api + path),
    onSuccess: () => cache.invalidateQueries({ queryKey }),
  });
  const data = course.data;
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <h1 className="text-3xl font-bold">Mes formations</h1>
    {course.isLoading && <p role="status">Chargement…</p>}
    {course.isError && <p role="alert">Chargement impossible. <button className="underline" onClick={() => course.refetch()}>Réessayer</button></p>}
    {data && <section className="space-y-4 rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{data.status === "COMPLETED" ? "Formation achetée · Paiement simulé" : "Formation disponible à l’achat"}</p>
      <h2 className="text-xl font-semibold">{data.title}</h2>
      <p>{data.themes.length} thèmes · {data.themes.reduce((total, theme) => total + theme.lessons.length, 0)} leçons</p>
      {data.status !== "COMPLETED" && <p>Un seul achat de {data.amount} FCFA fictifs donne accès à toute la formation.</p>}
      {data.status === "UNPAID" && <Button disabled={payment.isPending} onClick={() => payment.mutate("/checkout")}>Simuler un paiement Mobile Money</Button>}
      {data.status === "ACCEPTED" && <><p role="status">Paiement pawaPay simulé en attente.</p><Button disabled={payment.isPending} onClick={() => payment.mutate("/checkout/" + data.checkoutId + "/simulate")}>Confirmer les 100 FCFA fictifs</Button></>}
      {payment.isError && <p role="alert">Le paiement simulé n’a pas pu être vérifié. Actualisez la page pour retrouver son état.</p>}
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
