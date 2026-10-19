import assert from "node:assert/strict";
import { canCheckQuality, canCheckHandover, handoverComplete } from "./garment-verification";

assert.equal(canCheckQuality("washing"), false);
assert.equal(canCheckQuality("ironing"), true);
assert.equal(canCheckQuality("packaging"), true);
assert.equal(canCheckQuality("delivered"), false);
assert.equal(canCheckHandover("packaging"), false);
assert.equal(canCheckHandover("ready"), true);
assert.equal(handoverComplete([]), false);
assert.equal(handoverComplete([{ quantity: 3, qualityCheckedQuantity: 3, handedOverQuantity: 2 }]), false);
assert.equal(handoverComplete([{ quantity: 3, qualityCheckedQuantity: 2, handedOverQuantity: 3 }]), false);
assert.equal(handoverComplete([{ quantity: 3, qualityCheckedQuantity: 3, handedOverQuantity: 3, returnedForTreatment: true }]), false);
assert.equal(handoverComplete([{ quantity: 3, qualityCheckedQuantity: 3, handedOverQuantity: 3 }]), true);
console.log("Garment verification stage and quantity rules passed");
