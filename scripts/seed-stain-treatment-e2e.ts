import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

export const ARTIFACT_DIR = path.join(process.cwd(), "artifacts/stain-treatment-e2e");
export const STATE_FILE = path.join(ARTIFACT_DIR, "seed-state.json");
export const SCHEMA_PATTERN = /^stain_e2e_[0-9a-f]{24}$/;

export type StainE2EState = {
  schema: string;
  baseUrl: string;
  orderId?: number;
  credentials: Record<"owner" | "capableManager" | "manager" | "operator", { email: string; password: string }>;
};

export function requireSafeTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required; refusing to use a default database");
  const forbidden = [env.DATABASE_URL, env.REPLIT_DATABASE_URL, env.PRODUCTION_DATABASE_URL].filter(Boolean);
  const parsed = new URL(value);
  const endpoint = (url: string) => {
    const candidate = new URL(url);
    return `${candidate.protocol}//${candidate.username}@${candidate.hostname.toLowerCase()}:${candidate.port || "default"}${candidate.pathname}`;
  };
  if (forbidden.some((url) => endpoint(url!) === endpoint(value))) {
    throw new Error("TEST_DATABASE_URL matches a configured application/production database");
  }
  const marker = /(^|[^a-z])(test|testing|ci|local)([^a-z]|$)/;
  const database = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (!marker.test(parsed.hostname.toLowerCase()) && !marker.test(database)) {
    throw new Error("TEST_DATABASE_URL host or database name is not clearly test-only");
  }
  return value;
}

export function schemaConnectionEnv(testUrl: string, schema: string): NodeJS.ProcessEnv {
  assert.match(schema, SCHEMA_PATTERN);
  return {
    ...process.env,
    DATABASE_URL: testUrl,
    DATABASE_SSL: testUrl.includes("sslmode=require") ? "true" : process.env.DATABASE_SSL,
    PGOPTIONS: `-c search_path=${schema}`,
    STAIN_E2E_SCHEMA: schema,
    SESSION_SECRET: process.env.SESSION_SECRET || "stain-e2e-session-secret-not-for-production",
    NODE_ENV: "test",
  };
}

async function seedRows(pool: pg.Pool, schema: string, state: StainE2EState) {
  const passwordHash = await bcrypt.hash(state.credentials.owner.password, 4);
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);
    await client.query("BEGIN");
    const users = Object.entries(state.credentials).map(([role, value]) => ({
      id: `stain-e2e-${role}`,
      ...value,
      type: role === "owner" ? "owner" : "staff",
      role: role === "owner" ? "owner" : role === "operator" ? "operator" : "manager",
    }));
    for (const user of users) {
      await client.query(
        `INSERT INTO users(id,email,first_name,last_name,password_hash,user_type,role,business_name)
         VALUES ($1,$2,'E2E',$3,$4,$5,$6,'Stain E2E')`,
        [user.id, user.email, user.role, passwordHash, user.type, user.role],
      );
    }
    const organisation = await client.query(
      `INSERT INTO organisations(name,owner_id,currency) VALUES ('Stain E2E Organisation',$1,'ZAR') RETURNING id`,
      [users[0].id],
    );
    const organisationId = organisation.rows[0].id;
    const site = await client.query(
      `INSERT INTO sites(organisation_id,name,address,city) VALUES ($1,'Stain E2E Site','Test only','Local') RETURNING id`,
      [organisationId],
    );
    const siteId = site.rows[0].id;
    for (const user of users) {
      await client.query(`UPDATE users SET organisation_id=$1,current_site_id=$2 WHERE id=$3`, [organisationId, siteId, user.id]);
    }
    await client.query(
      `INSERT INTO site_members(site_id,user_id,role,capabilities) VALUES
       ($1,$2,'manager','["manage_stain_treatment_pricing","view_stain_treatment_reports"]'),
       ($1,$3,'manager','[]'),($1,$4,'operator','[]')`,
      [siteId, users[1].id, users[2].id, users[3].id],
    );
    const services = await client.query(
      `INSERT INTO services(site_id,name,unit,price,category,active) VALUES
       ($1,'E2E Shirt','piece',40,'Laundry',true),($1,'E2E Wash by kg','kg',25,'Laundry',true) RETURNING id,unit`,
      [siteId],
    );
    const customer = await client.query(
      `INSERT INTO customers(site_id,name,phone,address) VALUES ($1,'E2E Customer','000-E2E','Test only') RETURNING id`,
      [siteId],
    );
    const pricingSet = await client.query(
      `INSERT INTO stain_treatment_pricing_sets(organisation_id,site_id,current_version) VALUES ($1,$2,1) RETURNING id`,
      [organisationId, siteId],
    );
    const prices: Record<string, string> = { standard: "10.00", intensive: "20.00", very_intensive: "30.00" };
    const rateIds = new Map<string, number>();
    for (const unit of ["piece", "kg"]) for (const level of ["standard", "intensive", "very_intensive"]) {
      const inserted = await client.query(
        `INSERT INTO stain_treatment_price_versions(pricing_set_id,organisation_id,site_id,set_version,level,unit,currency,price,active,created_by)
         VALUES ($1,$2,$3,1,$4,$5,'ZAR',$6,true,$7) RETURNING id`,
        [pricingSet.rows[0].id, organisationId, siteId, level, unit, prices[level], users[0].id],
      );
      rateIds.set(`${level}:${unit}`, inserted.rows[0].id);
    }
    // Seed a membership plan so the order UI exercises the rule that treatment is never discounted.
    await client.query(
      `INSERT INTO subscription_plans(organisation_id,name,status,billing_cycle,duration_days,recurring_price,discount_percentage)
       VALUES ($1,'E2E Member','active','monthly',30,100,10)`,
      [organisationId],
    );
    const order = await client.query(
      `INSERT INTO orders(customer_id,status,total_amount,payment_status,original_price,site_id,organisation_id,idempotency_key,request_fingerprint,posted_at)
       VALUES ($1,'received',165,'paid',165,$2,$3,'stain-e2e-posted-order','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',now()) RETURNING id`,
      [customer.rows[0].id, siteId, organisationId],
    );
    state.orderId = order.rows[0].id;
    const pieceService = services.rows.find((row) => row.unit === "piece").id;
    const kgService = services.rows.find((row) => row.unit === "kg").id;
    const items = await client.query(
      `INSERT INTO order_items(order_id,service_id,quantity,price_at_order) VALUES ($1,$2,2,40),($1,$3,1,25) RETURNING id,service_id`,
      [state.orderId, pieceService, kgService],
    );
    const pieceItem = items.rows.find((row) => row.service_id === pieceService).id;
    const kgItem = items.rows.find((row) => row.service_id === kgService).id;
    const treatments: Array<[string, string, number, string, number, boolean]> = [
      ["standard", "piece", pieceItem, "1", rateIds.get("standard:piece")!, false],
      ["intensive", "kg", kgItem, "1", rateIds.get("intensive:kg")!, false],
      ["very_intensive", "piece", pieceItem, "1", rateIds.get("very_intensive:piece")!, true],
    ];
    const treatmentIds: number[] = [];
    for (const [level, unit, itemId, quantity, rateId, acknowledged] of treatments) {
      const inserted = await client.query(
        `INSERT INTO order_stain_treatments(organisation_id,site_id,order_id,order_item_id,level,unit,quantity,captured_rate,line_total,currency,pricing_version_id,pricing_set_version,idempotency_key,acknowledgement_affirmed,acknowledgement_text_version,acknowledged_by,acknowledged_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ZAR',$10,1,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [organisationId, siteId, state.orderId, itemId, level, unit, quantity, prices[level], prices[level], rateId, `stain-e2e-${level}-${unit}`, acknowledged ? true : null, acknowledged ? "v1" : null, acknowledged ? users[0].id : null, acknowledged ? new Date() : null, users[0].id],
      );
      treatmentIds.push(inserted.rows[0].id);
    }
    const payment = await client.query(
      `INSERT INTO payments(order_id,amount,method,is_advance,idempotency_key,organisation_id,site_id,request_fingerprint)
       VALUES ($1,165,'cash',false,'stain-e2e-payment',$2,$3,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') RETURNING id`,
      [state.orderId, organisationId, siteId],
    );
    await client.query(
      `INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,service_amount) VALUES ($1,$2,$3,105)`,
      [payment.rows[0].id, organisationId, siteId],
    );
    for (const [index, amount] of ["10", "20", "30"].entries()) {
      await client.query(
        `INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,treatment_id,treatment_amount) VALUES ($1,$2,$3,$4,$5)`,
        [payment.rows[0].id, organisationId, siteId, treatmentIds[index], amount],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setupStainTreatmentE2E(): Promise<void> {
  const testUrl = requireSafeTestDatabaseUrl();
  const schema = process.env.STAIN_E2E_SCHEMA || `stain_e2e_${randomBytes(12).toString("hex")}`;
  assert.match(schema, SCHEMA_PATTERN);
  const state: StainE2EState = {
    schema,
    baseUrl: process.env.STAIN_E2E_BASE_URL || "http://127.0.0.1:41739",
    credentials: {
      owner: { email: "owner.stain.e2e@example.test", password: "E2e-Stain-Only-7391" },
      capableManager: { email: "capable.stain.e2e@example.test", password: "E2e-Stain-Only-7391" },
      manager: { email: "manager.stain.e2e@example.test", password: "E2e-Stain-Only-7391" },
      operator: { email: "operator.stain.e2e@example.test", password: "E2e-Stain-Only-7391" },
    },
  };
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const adminPool = new pg.Pool({ connectionString: testUrl, max: 2 });
  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    execFileSync("npm", ["run", "db:push", "--", "--force"], {
      cwd: process.cwd(), env: schemaConnectionEnv(testUrl, schema), stdio: "inherit",
    });
    await seedRows(adminPool, schema, state);
    await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    throw error;
  } finally {
    await adminPool.end();
  }
}

export async function cleanupStainTreatmentE2E(): Promise<void> {
  const testUrl = requireSafeTestDatabaseUrl();
  const state = JSON.parse(await readFile(STATE_FILE, "utf8")) as StainE2EState;
  assert.match(state.schema, SCHEMA_PATTERN);
  const pool = new pg.Pool({ connectionString: testUrl, max: 1 });
  try { await pool.query(`DROP SCHEMA IF EXISTS "${state.schema}" CASCADE`); }
  finally {
    await pool.end();
    await rm(STATE_FILE, { force: true });
  }
}

if (process.argv[1]?.endsWith("seed-stain-treatment-e2e.ts")) {
  const command = process.argv[2] || "setup";
  if (command === "setup") await setupStainTreatmentE2E();
  else if (command === "cleanup") await cleanupStainTreatmentE2E();
  else throw new Error(`Unknown stain E2E seed command: ${command}`);
}
