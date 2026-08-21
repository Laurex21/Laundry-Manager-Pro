import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canTransitionReturn, requiresDecisionJustification, validateEvidenceImages } from "./garment-return-rules";

assert.equal(canTransitionReturn("pending_review", "approved"), true);
assert.equal(canTransitionReturn("pending_review", "rejected"), true);
assert.equal(canTransitionReturn("approved", "in_rework"), true);
assert.equal(canTransitionReturn("in_rework", "quality_check"), true);
assert.equal(canTransitionReturn("quality_check", "resolved"), true);
assert.equal(canTransitionReturn("pending_review", "resolved"), false);
assert.equal(canTransitionReturn("rejected", "approved"), false);
assert.equal(requiresDecisionJustification("reject"), true);
assert.equal(requiresDecisionJustification("credit"), true);
assert.equal(requiresDecisionJustification("refund"), true);
assert.equal(requiresDecisionJustification("rewash"), false);

assert.deepEqual(validateEvidenceImages([]), []);
assert.throws(() => validateEvidenceImages(new Array(4).fill({ mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" })), /maximum of 3/i);
assert.throws(() => validateEvidenceImages([{ mimeType: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,AA==" }]), /JPEG, PNG, or WebP/i);

const routes = readFileSync("server/lib/garment-return-routes.ts", "utf8");
const mainRoutes = readFileSync("server/routes.ts", "utf8");

for (const endpoint of [
  "/api/orders/:orderId/garment-returns",
  "/api/garment-returns",
  "/api/garment-returns/:id/decision",
  "/api/garment-returns/:id/transition",
  "/api/garment-returns/:id/events",
]) assert.match(routes, new RegExp(endpoint.replace(/[/:]/g, (value) => value === "/" ? "\\/" : value)));

assert.match(routes, /eq\(orders\.status, "delivered"\)/, "post-delivery returns require a delivered order");
assert.match(routes, /inArray\(orders\.siteId, allowedSiteIds\)/, "order access must be site scoped");
assert.match(routes, /organisationWide \? req\.authorizedSiteIds : req\.siteScope/, "organisation-wide resource access must never exceed the user's assigned sites");
assert.match(routes, /eq\(garmentReturnCases\.organisationId, organisationId\)/, "return cases must be tenant scoped");
assert.match(routes, /requireManagerOrOwner/, "decision and resolution must be manager-only");
assert.match(routes, /garmentReturnEvents/, "every mutation must create an immutable event");
assert.match(routes, /23505/, "duplicate active returns must map to a conflict response");
assert.match(mainRoutes, /registerGarmentReturnRoutes\(app\)/);
assert.match(mainRoutes, /\/api\/garment-items\/:id\/return/, "internal production return endpoint must remain available");

console.log("garment return route regressions passed");
