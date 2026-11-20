// Offline demonstration only. No external database, API call, email or WhatsApp.
import { randomBytes } from "node:crypto";
import { storefrontFixture } from "./storefront-fixture";
import { StorefrontFlowAdapter } from "../server/lib/storefront-flows";
const f = await storefrontFixture();
try {
  const adapter = new StorefrontFlowAdapter(f.service, randomBytes(32), async () => ({ id: "demo", actor: f.actor, phoneNumberId: "DEMO", flowId: "DEMO", enabled: true }));
  const launch = await adapter.launch("demo", "+237600000001");
  const call = (action: string, screen?: string, data: Record<string, unknown> = {}) => adapter.handle({ version: "4.0", flow_token: launch.flow_token, action, screen, data });
  let state = await call("INIT");
  for (const [garment, size, count] of [["tshirt", "child", "3"], ["shirt", "adult", "2"], ["jeans", "teen", "1"]]) {
    state = await call("data_exchange", "ITEMS", { operation: "add", cart_token: state.data.cart_token, service_id: "1", garment, size, count });
    if (garment !== "jeans") state = await call("data_exchange", "CART", { operation: "more", cart_token: state.data.cart_token });
  }
  console.log(state.data.summary); console.log(state.data.estimate);
  state = await call("data_exchange", "CART", { operation: "checkout", cart_token: state.data.cart_token });
  await call("data_exchange", "CONTACT", { operation: "confirm", cart_token: state.data.cart_token, customer_name: "Client démo Flow", note: "Démo isolée", accepted: true });
  console.log(`Demandes reçues dans Xpress Pro : ${(await f.service.inbox(f.actor)).length}. Aucun message envoyé, aucun paiement effectué.`);
} finally { await f.pg.close(); }
