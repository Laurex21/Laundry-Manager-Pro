import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "./i18n";
import { readPlanIntent, planIntentUrl } from "./saas-plan-intent";
import { SaasPublicPlans, SaasTrialInfo } from "../components/saas-public-plans";
import { SaasPlanIntent } from "../components/saas-plan-intent";
import FippPage from "../pages/fipp";
import { fippDaysToGo } from "../../../shared/fipp-event";
import { saasSignupOffer } from "../../../server/lib/saas-public-offer";

Object.assign(globalThis, { React });
globalThis.fetch = async () => { throw new Error("Network forbidden in public journey tests"); };
for (const plan of ["starter", "pro", "business"] as const) {
  const selection = { plan, extraSites: 0, extraStaff: 0 };
  const registration = planIntentUrl("/auth", selection, "register");
  assert.deepEqual(readPlanIntent(registration.split("?")[1]), selection);
  const login = planIntentUrl("/auth", selection, "login");
  assert.deepEqual(readPlanIntent(login.split("?")[1]), selection);
  assert.deepEqual(readPlanIntent(planIntentUrl("/subscriptions", selection).split("?")[1]), selection);
}
const custom = { plan: "business" as const, extraSites: 2, extraStaff: 3 };
assert.deepEqual(readPlanIntent(planIntentUrl("/auth", custom, "register").split("?")[1]), custom);
for (const search of ["", "plan=enterprise", "plan=__proto__", "plan=pro&extraSites=1", "plan=starter&extraStaff=1", "plan=business&extraSites=-1", "plan=business&extraStaff=1.5", "plan=business&extraStaff=1001", "plan=business&extraStaff=1e2", "plan=business&extraSites="]) assert.equal(readPlanIntent(search), null, search);
assert.equal(planIntentUrl("/auth", null, "login"), "/auth");

assert.equal(saasSignupOffer({SAAS_BILLING_MODE:"disabled"}), null);
assert.deepEqual(saasSignupOffer({NODE_ENV:"test",SAAS_BILLING_MODE:"sandbox",SAAS_BUSINESS_LAUNCH_ENABLED:"true"}), {plan:"business",days:30});
assert.deepEqual(saasSignupOffer({NODE_ENV:"test",SAAS_BILLING_MODE:"sandbox"}), {plan:"pro",days:30});
const live = {NODE_ENV:"production",SAAS_BILLING_MODE:"live",SAAS_LIVE_ENABLED:"true",SAAS_DATABASE_ENVIRONMENT:"production",PAWAPAY_PRODUCTION_API_TOKEN:"synthetic-never-used",SAAS_PRODUCTION_ORIGIN:"https://example.com",SAAS_BUSINESS_LAUNCH_ENABLED:"true"};
assert.deepEqual(saasSignupOffer(live), {plan:"business",days:30});
assert.equal(saasSignupOffer({...live,SAAS_LIVE_PILOT_ORGANISATION_ID:"10"}),null);
assert.equal(saasSignupOffer({...live,SAAS_LIVE_PILOT_PURPOSE:"collection"}),null);

function render(config: unknown, children: React.ReactNode) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(["/api/saas/config"], config);
  const html = renderToStaticMarkup(<Router ssrPath="/xpresspro"><QueryClientProvider client={client}>{children}</QueryClientProvider></Router>);
  client.clear();return html;
}
for (const language of ["fr", "en"]) {
  await i18n.changeLanguage(language);
  const html = render({enabled:false,signupOffer:{plan:"business",days:30}}, <SaasPublicPlans/>);
  assert.match(html, /30 (jours de Business|days of free Business)/, "Welcome offer is independent of the visitor's payment flag");
  for (const plan of ["starter","pro","business"]) assert.ok(html.includes(`plan=${plan}`));
  const starter = render({enabled:false,signupOffer:null}, <SaasTrialInfo/>);
  assert.match(starter, /démarre sur Starter gratuit|starts on free Starter/);
  assert.doesNotMatch(starter, /30 jours|30 days/);
  const unavailable = render({enabled:false}, <SaasTrialInfo/>);
  assert.match(unavailable, /temporairement|momentanément|temporarily/);
  const intent = render({}, <SaasPlanIntent selection={custom}/>);
  assert.match(intent, /4 (boutiques|sites)/);
  assert.match(intent, /12 (places employés|staff places)/);
  assert.match(intent, /aucun paiement|no automatic payment/);
  const fipp = renderToStaticMarkup(<Router ssrPath="/rencontre"><FippPage/></Router>);
  assert.match(fipp, /5 000/);assert.match(fipp,/10 000/);assert.match(fipp,/15 000/);
  assert.match(fipp, /237651638889/);
  if(language === "en") {
    assert.match(fipp,/International Forum for Laundry Professionals/);
    assert.match(fipp,/Provisional programme/);assert.match(fipp,/Venue to be announced/);
    assert.match(fipp,/Hello%2C/);
    assert.doesNotMatch(fipp,/Réserver|Conférence|Lieu bientôt|Une initiative|Décembre|personne|Devenir exposant/);
  } else { assert.match(fipp,/Forum international des professionnels du pressing/);assert.match(fipp,/Bonjour%2C/); }
}
assert.equal(fippDaysToGo(Date.parse("2026-12-18T22:59:59Z")),1);
assert.equal(fippDaysToGo(Date.parse("2026-12-18T23:00:00Z")),0);
assert.equal(fippDaysToGo(Date.parse("2026-12-19T23:00:00Z")),-1);
console.log("PASS public journey: plan/options retained, invalid intents ignored, truthful welcome offers, bilingual FIPP, Douala day boundary; no network or payment");
