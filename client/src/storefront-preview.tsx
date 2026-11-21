// Development-only entry point, excluded from the production application's import graph.
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import StorefrontPublic from "./pages/storefront-public";
import StorefrontAdmin from "./pages/storefront-admin";
import StorefrontFlowSignup from "./pages/storefront-flow-signup";
import StorefrontTracking from "./pages/storefront-tracking";
import { money, storefrontApi } from "./components/storefront-ui";
import "./index.css";
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function PreviewOrder() {
  const query = useQuery({ queryKey: [location.pathname], queryFn: () => storefrontApi(`/api/storefront-preview${location.pathname}`) });
  const order = query.data;
  return <main className="sf sf-admin"><span className="sf-eyebrow">Commande réellement créée dans la base de test</span><h1>{order?.orderReference ?? "Chargement…"}</h1>{order && <section className="sf-card sf-stack"><p>État : reçu · Paiement : {order.paymentStatus === "unpaid" ? "non réglé" : order.paymentStatus}</p>{order.items.map((item: any, i: number) => <div className="sf-row" key={i}><span>{item.name}<small>{Number(item.quantity)} {item.unit} × {money(item.priceAtOrder, "XAF")}</small></span><strong>{money(String(Number(item.quantity) * Number(item.priceAtOrder)), "XAF")}</strong></div>)}<div className="sf-total"><span>Total</span><strong>{money(order.totalAmount, "XAF")}</strong></div><p>Dans Xpress Pro, ce lien ouvre la fiche commande habituelle pour encaisser, imprimer le reçu et suivre le traitement. Cet aperçu local vérifie la conversion ; aucun paiement réel n’est effectué.</p></section>}</main>;
}
const Page = location.pathname === "/boutique/connexion-whatsapp" ? StorefrontFlowSignup : location.pathname.startsWith("/b/") ? StorefrontPublic : location.pathname === "/suivi-boutique" ? StorefrontTracking : location.pathname.startsWith("/orders/") ? PreviewOrder : StorefrontAdmin;
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><div className="sf-preview"><strong>TEST LOCAL · données fictives, effacées à l’arrêt</strong><a href="/b/pressing-horizon">Vue client</a><a href="/boutique">Vue pressing</a></div><Page /></QueryClientProvider>);
