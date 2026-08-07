import { createHash } from "node:crypto";
import { allocateMoney, canonicalMoney, hasStainCapability, sumMoney } from "../../shared/order-money";
export * from "../../shared/order-money";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) {
    try { return canonicalMoney(value); } catch { return value; }
  }
  return value;
}

export function fingerprintRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export type PaidCorrectionOutcome =
  | { kind: "balance"; amount: string }
  | { kind: "customer_credit"; amount: string }
  | { kind: "approved_internal_refund"; amount: string; externalTransfer: false }
  | { kind: "balanced"; amount: "0.00" };

export function paidCorrectionOutcome(
  kind: PaidCorrectionOutcome["kind"],
  amount: string,
): PaidCorrectionOutcome {
  const canonical = canonicalMoney(amount);
  if (kind === "approved_internal_refund") return { kind, amount: canonical, externalTransfer: false };
  if (kind === "balanced") return { kind, amount: "0.00" };
  return { kind, amount: canonical };
}

export class OrderMoneyConflictError extends Error {
  readonly statusCode = 409;
}

export interface MoneyQueryClient {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}
export interface MoneyTransactionSource {
  connect(): Promise<MoneyQueryClient & { release(): void }>;
}

export async function resolveStainCapability(client: MoneyQueryClient, input: { userId: string; organisationId: number; siteId: number }) {
  const result = await client.query(
    `SELECT CASE WHEN o.owner_id=$1 THEN 'owner' ELSE sm.role END AS role,
            CASE WHEN o.owner_id=$1 THEN '[]'::jsonb ELSE coalesce(sm.capabilities,'[]'::jsonb) END AS capabilities
     FROM organisations o LEFT JOIN site_members sm ON sm.site_id=$3 AND sm.user_id=$1
     WHERE o.id=$2`,
    [input.userId,input.organisationId,input.siteId],
  );
  const row = result.rows[0];
  const capabilities = Array.isArray(row?.capabilities) ? row.capabilities : [];
  return { role: row?.role ?? null, capabilities, canManagePricing: row ? hasStainCapability(row.role, capabilities) : false };
}

export async function withMoneyTransaction<T>(source: MoneyTransactionSource, operation: (client: MoneyQueryClient) => Promise<T>): Promise<T> {
  const client = await source.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

type Allocation = { target: "service" | "pickup_delivery" | "unallocated"; amount: string };
type TenantInput = { organisationId: number; siteId: number; orderId: number; idempotencyKey: string };

function allocationColumn(target: Allocation["target"]) {
  return target === "service" ? "service_amount" : target === "pickup_delivery" ? "pickup_delivery_amount" : "unallocated_amount";
}

async function persistAllocations(client: MoneyQueryClient, table: "order_payment_allocations" | "order_refund_allocations", parent: "payment" | "refund", parentId: number, tenant: Pick<TenantInput, "organisationId" | "siteId">, allocations: Allocation[]) {
  for (const allocation of allocations) {
    const amount = canonicalMoney(allocation.amount);
    if (amount === "0.00") continue;
    const column = allocationColumn(allocation.target);
    await client.query(
      `INSERT INTO ${table} (${parent}_id, organisation_id, site_id, ${column}) VALUES ($1, $2, $3, $4)`,
      [parentId, tenant.organisationId, tenant.siteId, amount],
    );
  }
}

export async function persistPaymentInTransaction(client: MoneyQueryClient, input: TenantInput & {
  amount: string; method: string; reference?: string | null; collectedByEmployeeId?: number | null;
  paymentDate?: Date; isAdvance?: boolean; allocations: Allocation[]; fingerprintContext?: unknown;
}) {
  const amount = canonicalMoney(input.amount);
  if (amount === "0.00") throw new Error("Payment amount must be positive");
  const fingerprint = fingerprintRequest({ orderId: input.orderId, amount, method: input.method, reference: input.reference ?? null, paymentDate: input.paymentDate?.toISOString() ?? null, isAdvance: !!input.isAdvance, allocations: input.allocations, context: input.fingerprintContext ?? null });
  const order = await client.query(
    `SELECT id FROM orders WHERE id = $1 AND organisation_id = $2 AND site_id = $3 FOR UPDATE`,
    [input.orderId, input.organisationId, input.siteId],
  );
  if (!order.rowCount) throw new Error("Order not found for tenant");
  const replay = await client.query(
    `SELECT * FROM payments WHERE organisation_id = $1 AND site_id = $2 AND idempotency_key = $3 FOR UPDATE`,
    [input.organisationId, input.siteId, input.idempotencyKey],
  );
  if (replay.rowCount) {
    if (replay.rows[0].request_fingerprint !== fingerprint) throw new OrderMoneyConflictError("Idempotency key was already used with a different payment request");
    return { payment: replay.rows[0], replayed: true, balance: await orderBalance(client, input) };
  }
  const inserted = await client.query(
    `INSERT INTO payments (order_id, collected_by_employee_id, amount, method, reference, date, is_advance, idempotency_key, organisation_id, site_id, request_fingerprint)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (organisation_id,site_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING *`,
    [input.orderId, input.collectedByEmployeeId ?? null, amount, input.method, input.reference ?? null, input.paymentDate ?? new Date(), !!input.isAdvance, input.idempotencyKey, input.organisationId, input.siteId, fingerprint],
  );
  if (!inserted.rowCount) {
    const raced = await client.query(`SELECT * FROM payments WHERE organisation_id=$1 AND site_id=$2 AND idempotency_key=$3`, [input.organisationId,input.siteId,input.idempotencyKey]);
    if (!raced.rowCount || raced.rows[0].request_fingerprint !== fingerprint) throw new OrderMoneyConflictError("Idempotency key was already used with a different payment request");
    return { payment: raced.rows[0], replayed: true, balance: await orderBalance(client, input) };
  }
  const allocations = allocateMoney(amount, input.allocations);
  await persistAllocations(client, "order_payment_allocations", "payment", inserted.rows[0].id, input, allocations);
  return { payment: inserted.rows[0], allocations, replayed: false, balance: await orderBalance(client, input) };
}

export async function createOrReplayPayment(source: MoneyTransactionSource, input: Parameters<typeof persistPaymentInTransaction>[1]) {
  return withMoneyTransaction(source, (client) => persistPaymentInTransaction(client, input));
}

export async function persistRefundInTransaction(client: MoneyQueryClient, input: TenantInput & {
  amount: string; reason: string; status: "approved_internal" | "customer_credit"; approvedBy?: string | null;
  allocations: Allocation[];
}) {
  const amount = canonicalMoney(input.amount);
  if (amount === "0.00") throw new Error("Refund amount must be positive");
  const fingerprint = fingerprintRequest({ orderId: input.orderId, amount, reason: input.reason, status: input.status, allocations: input.allocations });
  const order = await client.query(`SELECT id FROM orders WHERE id=$1 AND organisation_id=$2 AND site_id=$3 FOR UPDATE`, [input.orderId, input.organisationId, input.siteId]);
  if (!order.rowCount) throw new Error("Order not found for tenant");
  const replay = await client.query(`SELECT * FROM order_refunds WHERE organisation_id=$1 AND site_id=$2 AND idempotency_key=$3 FOR UPDATE`, [input.organisationId, input.siteId, input.idempotencyKey]);
  if (replay.rowCount) {
    if (replay.rows[0].request_fingerprint !== fingerprint) throw new OrderMoneyConflictError("Idempotency key was already used with a different refund request");
    return { refund: replay.rows[0], replayed: true, balance: await orderBalance(client, input) };
  }
  const inserted = await client.query(
    `INSERT INTO order_refunds (organisation_id,site_id,order_id,amount,reason,status,idempotency_key,request_fingerprint,approved_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (organisation_id,site_id,idempotency_key) DO NOTHING RETURNING *`,
    [input.organisationId,input.siteId,input.orderId,amount,input.reason,input.status,input.idempotencyKey,fingerprint,input.approvedBy ?? null],
  );
  if (!inserted.rowCount) {
    const raced = await client.query(`SELECT * FROM order_refunds WHERE organisation_id=$1 AND site_id=$2 AND idempotency_key=$3`, [input.organisationId,input.siteId,input.idempotencyKey]);
    if (!raced.rowCount || raced.rows[0].request_fingerprint !== fingerprint) throw new OrderMoneyConflictError("Idempotency key was already used with a different refund request");
    return { refund: raced.rows[0], replayed: true, balance: await orderBalance(client, input) };
  }
  const allocations = allocateMoney(amount, input.allocations);
  await persistAllocations(client, "order_refund_allocations", "refund", inserted.rows[0].id, input, allocations);
  return { refund: inserted.rows[0], allocations, replayed: false, balance: await orderBalance(client, input) };
}

export async function createOrReplayRefund(source: MoneyTransactionSource, input: Parameters<typeof persistRefundInTransaction>[1]) {
  return withMoneyTransaction(source, (client) => persistRefundInTransaction(client, input));
}

export async function orderBalance(client: MoneyQueryClient, input: Pick<TenantInput, "organisationId" | "siteId" | "orderId">) {
  const result = await client.query(
    `SELECT greatest(o.total_amount - coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id AND p.organisation_id=o.organisation_id AND p.site_id=o.site_id),0)
       + coalesce((SELECT sum(r.amount) FROM order_refunds r WHERE r.order_id=o.id AND r.organisation_id=o.organisation_id AND r.site_id=o.site_id),0),0)::text AS balance
     FROM orders o WHERE o.id=$1 AND o.organisation_id=$2 AND o.site_id=$3`,
    [input.orderId,input.organisationId,input.siteId],
  );
  if (!result.rowCount) throw new Error("Order not found for tenant");
  return canonicalMoney(result.rows[0].balance);
}

async function persistPaidCorrectionOutcome(client: MoneyQueryClient, input: TenantInput & {
  kind: PaidCorrectionOutcome["kind"]; amount: string; reason: string; actorUserId?: string | null;
  customerId?: number; allocations?: Allocation[];
}) {
  const outcome = paidCorrectionOutcome(input.kind, input.amount);
  const correctionFingerprint = fingerprintRequest({ kind: outcome.kind, amount: outcome.amount, reason: input.reason, customerId: input.customerId ?? null });
  const order = await client.query(`SELECT id FROM orders WHERE id=$1 AND organisation_id=$2 AND site_id=$3 FOR UPDATE`, [input.orderId,input.organisationId,input.siteId]);
  if (!order.rowCount) throw new Error("Order not found for tenant");
  const replay = await client.query(
    `SELECT after_snapshot FROM order_corrections WHERE order_id=$1 AND site_id=$2 AND after_snapshot->>'idempotencyKey'=$3 ORDER BY id LIMIT 1`,
    [input.orderId,input.siteId,input.idempotencyKey],
  );
  if (replay.rowCount) {
    if (replay.rows[0].after_snapshot?.requestFingerprint !== correctionFingerprint) throw new OrderMoneyConflictError("Idempotency key was already used with a different correction request");
    return outcome;
  }
  await client.query(
    `INSERT INTO order_corrections (order_id,site_id,reason,before_snapshot,after_snapshot,changed_by)
     VALUES ($1,$2,$3,jsonb_build_object('financialOutcome','pending'),jsonb_build_object('financialOutcome',$4,'amount',$5,'idempotencyKey',$6,'requestFingerprint',$7),$8)`,
    [input.orderId,input.siteId,input.reason,outcome.kind,outcome.amount,input.idempotencyKey,correctionFingerprint,input.actorUserId ?? null],
  );
  if (outcome.kind === "balanced" || outcome.kind === "balance") return outcome;
  if (outcome.kind === "approved_internal_refund") {
    await persistRefundInTransaction(client, {
      ...input,
      amount: outcome.amount,
      status: "approved_internal",
      approvedBy: input.actorUserId,
      allocations: input.allocations ?? [{ target: "unallocated", amount: outcome.amount }],
    });
    return outcome;
  }
  if (!input.customerId) throw new Error("Customer is required for a correction credit");
  const customer = await client.query(
    `SELECT credit_balance FROM customers WHERE id=$1 AND site_id=$2 FOR UPDATE`,
    [input.customerId, input.siteId],
  );
  if (!customer.rowCount) throw new Error("Customer not found for tenant site");
  const before = canonicalMoney(customer.rows[0].credit_balance ?? "0");
  const after = sumMoney([before, outcome.amount]);
  const inserted = await client.query(
    `INSERT INTO credit_transactions (organisation_id,site_id,customer_id,order_id,type,amount,reason,balance_before,balance_after,notes,created_by,idempotency_key)
     VALUES ($1,$2,$3,$4,'credit',$5,'order_correction',$6,$7,$8,$9,$10)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [input.organisationId,input.siteId,input.customerId,input.orderId,outcome.amount,before,after,input.reason,input.actorUserId ?? null,`${input.organisationId}:${input.siteId}:${input.idempotencyKey}:correction-credit`],
  );
  if (inserted.rowCount) {
    await client.query(`UPDATE customers SET credit_balance=$2,total_credit_added=total_credit_added+$3 WHERE id=$1 AND site_id=$4`, [input.customerId,after,outcome.amount,input.siteId]);
  }
  return outcome;
}

export async function recordPaidCorrectionOutcome(source: MoneyTransactionSource, input: Parameters<typeof persistPaidCorrectionOutcome>[1]) {
  return withMoneyTransaction(source, (client) => persistPaidCorrectionOutcome(client, input));
}
