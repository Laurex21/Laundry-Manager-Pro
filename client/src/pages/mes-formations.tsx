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
  modules: { id: string; title: string }[];
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
      {data.status !== "COMPLETED" && <p>Les six modules sont inclus pour {data.amount} FCFA en simulation.</p>}
      <ol className="list-decimal space-y-3 pl-6">{data.modules.map(module =>
        <li key={module.id}>{data.status === "COMPLETED"
          ? <a href={api + "/modules/" + module.id} target="_blank" rel="noreferrer" className="font-medium text-primary underline">{module.title}</a>
          : module.title}</li>)}</ol>
      {data.status === "UNPAID" && <Button disabled={payment.isPending} onClick={() => payment.mutate("/checkout")}>Simuler un paiement Mobile Money</Button>}
      {data.status === "ACCEPTED" && <><p role="status">Paiement pawaPay simulé en attente.</p><Button disabled={payment.isPending} onClick={() => payment.mutate("/checkout/" + data.checkoutId + "/simulate")}>Confirmer les 100 FCFA fictifs</Button></>}
      {payment.isError && <p role="alert">Le paiement simulé n’a pas pu être vérifié. Actualisez la page pour retrouver son état.</p>}
    </section>}
  </main>;
}
