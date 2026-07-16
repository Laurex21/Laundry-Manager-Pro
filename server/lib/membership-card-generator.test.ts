import assert from "node:assert/strict";
import { buildMembershipCard, membershipQrContent } from "./membership-card-generator";

async function main() {
  const qr = membershipQrContent(42, "XP-42-TEST", "2026-12-31");
  assert.equal(qr, "XPRESSPRO:42:XP-42-TEST:2026-12-31");

  const card = await buildMembershipCard(
    42,
    { name: "Test Client" },
    { membershipNumber: "XP-42-TEST", startDate: "2026-01-01", expiryDate: "2026-12-31", status: "active" },
    { name: "Gold" },
    { businessName: "XpressPro", logoBase64: null },
  );
  assert.ok(card.qrCode.startsWith("data:image/png;base64,"));
  assert.ok(card.digitalCardImage.startsWith("data:image/png;base64,"));
  assert.ok(card.png.length > 1_000);
  assert.equal(card.png.subarray(1, 4).toString(), "PNG");
  console.log(`membership card generator tests passed (${card.png.length} PNG bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
