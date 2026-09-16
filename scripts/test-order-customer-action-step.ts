import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("client/src/pages/orders.tsx"), "utf8");

if (!source.includes('wizardStep === 1 && <div className="flex min-w-0 items-center justify-between')) {
  throw new Error("The customer header must only render on wizard step 1");
}

if (!source.includes('data-testid="order-wizard-customer-header"')) {
  throw new Error("Missing customer-header regression marker");
}

if (source.includes('wizardStep === 1 && showAddCustomer ?')) {
  throw new Error("The customer form wrapper must remain structurally valid while the action is step-scoped");
}

console.log("Order customer action step regression test passed");
