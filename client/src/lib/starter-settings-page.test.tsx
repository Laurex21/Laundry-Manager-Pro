import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "./i18n";
import Settings from "../pages/settings";

Object.assign(globalThis, { React });
globalThis.fetch = async () => { throw new Error("Unexpected network request in settings test"); };
await i18n.changeLanguage("fr");

for (const [plan, legacyPlan] of [
  ["starter", "pro"], [undefined, "starter"], ["pro", "starter"], ["business", "starter"],
]) {
  const client = new QueryClient();
  const effectivePlan = plan ?? legacyPlan;
  client.setQueryData(["/api/auth/user"], {
    id: "test-owner", role: "owner", planSlug: legacyPlan, saas: plan ? { plan } : undefined,
  });
  client.setQueryData(["/api/settings", effectivePlan], { businessName: "Enseigne enregistrée" });
  try {
    const html = renderToStaticMarkup(<QueryClientProvider client={client}><Settings /></QueryClientProvider>);
    if (effectivePlan === "starter") {
      assert.match(html, /data-testid="starter-settings-basic"/);
      assert.match(html, />XpressPro<\//);
      assert.doesNotMatch(html, /Enseigne enregistrée|(?:id|name)="businessName"|data-testid="input-business-name"|(?:value|placeholder)="XpressPro"/i);
    } else {
      assert.match(html, /data-testid="input-business-name"[^>]*value="Enseigne enregistrée"|value="Enseigne enregistrée"[^>]*data-testid="input-business-name"/);
    }
  } finally {
    client.clear();
  }
}
console.log("PASS Starter settings page: fixed XpressPro name, legacy accounts and paid editing.");
