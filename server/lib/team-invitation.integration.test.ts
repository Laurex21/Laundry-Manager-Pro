import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";
import { newTeamInvitation, invitationWhatsAppRecipient } from "../../shared/team-invitation";

process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/team_invitation_test";
process.env.SAAS_BILLING_MODE = "disabled";
process.env.SAAS_DEFERRED_ORGANISATION_IDS = "100";
process.env.SESSION_SECRET = "isolated-team-invitation-test-fixture";
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = "true";
const pg = new PGlite();
const testDb = drizzle(pg, { schema });
const { db, pool } = await import("../db");
for (const method of ["select", "insert", "update", "transaction"] as const) {
  Object.assign(db, { [method]: testDb[method].bind(testDb) });
}
const { storage } = await import("../storage");

try {
  for (const statement of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) {
    await pg.exec(statement);
  }
  await testDb.insert(schema.users).values({ id: "test-owner", userType: "owner" });
  await testDb.insert(schema.organisations).values({ id: 100, ownerId: "test-owner", name: "Test" });
  await testDb.insert(schema.sites).values({ id: 10, organisationId: 100, name: "Test site" });
  const scope = { organisationId: 100, invitedBy: "test-owner" };
  const site = { siteId: 10, role: "operator" };
  const passwordHash = "unused-in-storage-test";

  // Install the migration against an invitation issued by the previous schema.
  await pg.exec("ALTER TABLE site_invitations DROP COLUMN notification_phone");
  await pg.query(
    `INSERT INTO site_invitations (site_id, organisation_id, invited_by, identifier, role, token, expires_at)
     VALUES (10, 100, 'test-owner', '+237699112233', 'operator', 'legacy-test', now() + interval '1 day')`,
  );
  const migration = readFileSync(new URL("../../migrations/20261126_team_invitation_notification_phone.sql", import.meta.url), "utf8");
  await pg.exec(migration);
  await pg.exec(migration);

  assert.equal(newTeamInvitation.safeParse({ ...site, identifier: "+237699112233" }).success, false);
  assert.equal(newTeamInvitation.safeParse({ ...site, notificationPhone: "699112233" }).success, false);
  assert.equal(newTeamInvitation.safeParse({ ...site, identifier: "agent@example.test", notificationPhone: "abc" }).success, false);
  for (const notificationPhone of [undefined, "", "  "]) {
    assert.equal(newTeamInvitation.parse({ ...site, identifier: "agent@example.test", notificationPhone }).notificationPhone, null);
  }
  // Exercise the registered HTTP handlers against the isolated database, including the audit write.
  await pg.exec(`CREATE TABLE security_audit_events (
    organisation_id integer, site_id integer, actor_user_id text, action text, target_type text, target_id text,
    before_state jsonb, after_state jsonb, request_id text, ip_hash text, user_agent text
  )`);
  const app = express();
  const { registerRoutes } = await import("../routes");
  await registerRoutes(createServer(), app);
  async function request(method: "get" | "post", path: string, body?: object) {
    const handler = app.router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])?.route.stack.at(-1).handle;
    assert.ok(handler, `Missing ${method} ${path}`);
    let status = 200;
    let result: any;
    const req = { method: method.toUpperCase(), session: { userId: scope.invitedBy }, body, ip: "127.0.0.1", protocol: "https", get: () => "pressing.example.invalid" };
    const res = { status(code: number) { status = code; return res; }, json(value: any) { result = value; } };
    await handler(req, res);
    assert.equal(status, method === "post" ? 201 : 200, JSON.stringify(result));
    return result;
  }
  const simple = await request("post", "/api/invitations", { ...site, identifier: " Agent@Example.test " });
  const notified = await request("post", "/api/invitations", { ...site, identifier: "agent2@example.test", notificationPhone: "+237 699 11 22 33" });
  for (const invitation of [simple, notified]) {
    assert.ok(invitation.token);
    assert.equal(invitation.invitationLink, "https://pressing.example.invalid/join/" + invitation.token);
  }
  const pending: Awaited<ReturnType<typeof storage.getPendingInvitations>> = await request("get", "/api/invitations/pending");
  const stored = pending.find(inv => inv.token === notified.token)!;
  assert.equal(stored.identifier, "agent2@example.test");
  assert.equal(invitationWhatsAppRecipient(stored), "237699112233");
  assert.equal(invitationWhatsAppRecipient(pending.find(inv => inv.token === simple.token)!), null);
  assert.equal(invitationWhatsAppRecipient(pending.find(inv => inv.token === "legacy-test")!), "237699112233");
  assert.equal(await storage.createStaffFromInvitation(notified.token, { phone: stored.notificationPhone, passwordHash }), null);
  const first = await storage.createStaffFromInvitation(simple.token, { email: "AGENT@example.test", passwordHash });
  assert.equal(first?.email, "agent@example.test");
  const second = await storage.createStaffFromInvitation(notified.token, { email: stored.identifier, passwordHash });
  assert.equal(second?.email, stored.identifier);
  assert.equal(second?.phone, null);
  assert.equal(await storage.createStaffFromInvitation(notified.token, { email: stored.identifier, passwordHash }), null);
  const legacy = await storage.createStaffFromInvitation("legacy-test", { phone: "699112233", passwordHash });
  assert.equal(legacy?.phone, "237699112233");
  const repeat = await storage.createInvitation({ ...scope, ...newTeamInvitation.parse({ ...site, identifier: "agent@example.test" }) });
  await assert.rejects(storage.createStaffFromInvitation(repeat.token, { email: first!.email, passwordHash }), /STAFF_EMAIL_IN_USE/);
  const accepted = await storage.acceptInvitation(repeat.token, first!.id);
  assert.equal(accepted?.status, "accepted");
  console.log("Email-only, optional WhatsApp, existing accounts and legacy phone invitations passed.");
} finally {
  await pg.close();
  await pool.end();
}
