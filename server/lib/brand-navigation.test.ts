import fs from "node:fs";
import path from "node:path";

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const shell = fs.readFileSync(path.join(root, "client/src/components/layout-shell.tsx"), "utf8");
const mark = fs.readFileSync(path.join(root, "client/public/xpresspro-mark.svg"), "utf8");

expect(shell.includes('src="/xpresspro-mark.svg"'), "Layout must use the approved XpressPro mark");
expect(shell.includes('Xpress<span className="text-[#6B5CFF]">Pro</span>'), "Layout must use the approved two-colour wordmark");
expect(!shell.includes('t("laundry_manager")</p>'), "The duplicated grey brand subtitle must be removed");
expect(shell.includes('function BackButton'), "Shared layout must provide a back button for secondary pages");
expect(shell.includes('window.history.back()'), "Back button must respect browser navigation history");
expect(shell.includes('referrer?.origin === window.location.origin'), "Back button must not send users back to an external site");
expect(shell.includes('setLocation("/dashboard")'), "Back button must have a safe dashboard fallback");
expect(shell.includes('path.startsWith("/orders/")') && shell.includes('path.startsWith("/customers/")'), "Shared back button must not duplicate detail-page controls");
expect(mark.includes("#082D5B") && mark.includes("#6B5CFF"), "Brand mark must retain approved navy and violet colours");

console.log("Brand and navigation regression checks passed");
