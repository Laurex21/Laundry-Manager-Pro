// Explicitly requested synthetic account, isolated from existing organisations.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
const target = new URL(process.env.DATABASE_URL || "postgresql://missing/invalid");
if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT ||
    !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev") ||
    target.hostname !== "helium" || target.pathname !== "/heliumdb" ||
    process.env.STOREFRONT_CREATE_TEST_ACCOUNT !== "1") {
  throw new Error("Explicit development test-account creation is required; only Replit helium/heliumdb is allowed.");
}
await mkdir("/tmp/xpresspro-storefront-run", { recursive: true, mode: 0o700 });
// Exclusive file creation prevents unnoticed duplication or resetting an existing password.
const credentials = await open("/tmp/xpresspro-storefront-run/fixture.json", "wx", 0o600);
const { db, pool } = await import("../server/db");
const s = await import("../shared/schema");
const { CURRENT_LEGAL_DOCUMENTS: legal } = await import("../server/lib/legal");
try {
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  const email = `boutique-test-${Date.now()}@example.invalid`;
  const fixture = await db.transaction(async tx => {
    await tx.insert(s.users).values({ id: userId, email, passwordHash, firstName: "Test", lastName: "Boutique", businessName: "TEST BOUTIQUE — SANS VALEUR COMMERCIALE", userType: "owner", role: "owner" });
    const [org] = await tx.insert(s.organisations).values({ ownerId: userId, name: "TEST BOUTIQUE — NE PAS UTILISER" }).returning();
    const [site] = await tx.insert(s.sites).values({ organisationId: org.id, name: "Pressing test boutique", address: "Adresse fictive de test", city: "Douala", phone: "+237600000000" }).returning();
    await tx.update(s.users).set({ organisationId: org.id, currentSiteId: site.id }).where(eq(s.users.id, userId));
    const services = await tx.insert(s.services).values([
      { siteId: site.id, name: "Lavage & pliage TEST", price: "1000", unit: "kg", category: "washing", description: "Service fictif au kilo — essai uniquement" },
      { siteId: site.id, name: "Repassage TEST", price: "500", unit: "piece", category: "ironing" },
      { siteId: site.id, name: "Tenue délicate TEST", price: "0", unit: "piece", category: "dry_cleaning" },
    ]).returning({ id: s.services.id, name: s.services.name });
    await tx.insert(s.businessSettings).values({ userId, businessName: "TEST BOUTIQUE — SANS VALEUR COMMERCIALE", address: "Adresse fictive de test", city: "Douala", country: "Cameroun", phone: "+237600000000", receiptLanguage: "fr", showTerms: false, receiptFooterNote: "ESSAI DE DÉVELOPPEMENT — AUCUN PAIEMENT RÉEL" });
    // A test fixture for the existing legal gate, never a person's consent or agreement.
    await tx.insert(s.legalAcceptances).values({ userId, organisationId: org.id, siteId: site.id, termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion, cookieVersion: legal.cookieVersion, documentHash: legal.documentHash, source: "synthetic_dev_fixture", metadata: { notRealAcceptance: true, purpose: "storefront development E2E", syntheticAccount: true } });
    return { email, userId, organisationId: org.id, siteId: site.id, services };
  });
  await credentials.writeFile(JSON.stringify({ ...fixture, password }, null, 2));
  console.log(JSON.stringify({ ...fixture, credentialsFile: "/tmp/xpresspro-storefront-run/fixture.json", note: "Fictitious development account only. No platform-admin rights; no real agreement or money." }));
} finally { await credentials.close(); await pool.end(); }
