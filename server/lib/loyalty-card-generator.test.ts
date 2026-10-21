import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { buildLoyaltyCard, loyaltyCardIdentifier } from "./loyalty-card-generator";

test("loyalty card is a downloadable PNG with a stable customer identifier", async () => {
  const card = await buildLoyaltyCard({ id: 42, name: "Client <Test>", loyaltyTier: "gold" }, 7, "Xpress Clean");
  const metadata = await sharp(card).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 648);
  assert.equal(metadata.height, 408);
  assert.equal(loyaltyCardIdentifier(7, 42), "XPRESSPRO-LOYALTY:7:42");
});
