import { Link } from "wouter";
import { BookOpen, MonitorPlay, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRAINING_VISIBLE } from "@/lib/training-availability";
import { coachingPrice, coursePrice } from "@shared/consulting-offers";

const price = (value: number) => new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
const card = "flex flex-col items-start gap-3 rounded-2xl border bg-card p-6";

export default function FormationHub() {
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <h1 className="font-display text-3xl font-bold">Formation</h1>
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card}>
        <BookOpen aria-hidden className="text-primary" />
        <h2 className="text-xl font-semibold">Gestion du pressing</h2>
        <p>57 leçons en 7 thèmes pour organiser le travail et gérer votre pressing.</p>
        <p className="mt-auto font-semibold">{price(coursePrice)} · Paiement unique</p>
        <Button asChild><Link href="/mes-formations">Voir la formation</Link></Button>
      </section>
      {TRAINING_VISIBLE && <section className={card}>
        <MonitorPlay aria-hidden className="text-primary" />
        <h2 className="text-xl font-semibold">Utiliser XpressPro</h2>
        <p>Suivez les démonstrations sur ordinateur ou téléphone pour prendre en main la plateforme.</p>
        <p className="mt-auto font-semibold">Gratuit</p>
        <Button asChild variant="outline"><Link href="/formation/xpresspro">Accéder aux tutoriels</Link></Button>
      </section>}
      <section className={card}>
        <MessagesSquare aria-hidden className="text-primary" />
        <h2 className="text-xl font-semibold">Accompagnement standard</h2>
        <p>Après paiement, contactez Xpress Consulting pour fixer votre rendez-vous.</p>
        <p className="mt-auto font-semibold">{price(coachingPrice)}</p>
        <Button asChild variant="outline"><Link href="/formation/accompagnement">Voir l’accompagnement</Link></Button>
      </section>
    </div>
  </main>;
}
