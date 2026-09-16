import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("client/src/pages/orders.tsx"), "utf8");

const required = [
  "const [submitExplicitlyRequested, setSubmitExplicitlyRequested] = useState(false)",
  "if (wizardStep !== 5 || !submitExplicitlyRequested) return",
  "if (wizardStep !== 5 || !submitExplicitlyRequested)",
  "event.key === \"Enter\"",
  "onClick={() => setSubmitExplicitlyRequested(true)}",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing explicit-submit guard: ${marker}`);
  }
}

if (!source.includes('wizardStep < 5 ? <Button type="button"')) {
  throw new Error("Next must remain a non-submit button");
}

console.log("Explicit order review submission guard verified");
