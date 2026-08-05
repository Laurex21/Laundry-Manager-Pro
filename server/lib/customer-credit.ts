import { pool } from "../db";

export const CREDIT_REASONS = ["manual_credit", "compensation", "advance_payment"] as const;

export class CreditOperationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

type PaymentOperationInput = {
  orderId: number;
  amountReceived: string;
  method: string;
  reference?: string | null;
  paymentDate?: Date;
  creditToApply: string;
  surplusDisposition: "return" | "credit";
  idempotencyKey: string;
  organisationId: number;
  siteId: number;
  actorUserId: string | null;
  collectedByEmployeeId: number | null;
};

function assertMoney(value: string, field: string, allowZero = true) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
    throw new CreditOperationError(`${field} must be a valid non-negative amount`);
  }
  if (!allowZero && /^0+(?:\.0{1,2})?$/.test(value)) {
    throw new CreditOperationError(`${field} must be greater than zero`);
  }
}

function assertIdempotencyKey(value: string) {
  if (!/^[A-Za-z0-9:_-]{16,80}$/.test(value)) {
    throw new CreditOperationError("A valid idempotency key is required");
  }
}

export async function recordPaymentWithCredit(input: PaymentOperationInput) {
  assertMoney(input.amountReceived, "amountReceived");
  assertMoney(input.creditToApply, "creditToApply");
  assertIdempotencyKey(input.idempotencyKey);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT p.*, c.credit_balance
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE p.idempotency_key IN ($1, $2)
       ORDER BY p.id
       LIMIT 1`,
      [`${input.idempotencyKey}:cash`, `${input.idempotencyKey}:credit`],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return {
        ...existing.rows[0],
        idempotentReplay: true,
        creditBalance: existing.rows[0].credit_balance,
      };
    }

    const orderResult = await client.query(
      `SELECT o.id, o.customer_id, o.site_id, o.status, o.total_amount, s.organisation_id
       FROM orders o
       JOIN sites s ON s.id = o.site_id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [input.orderId],
    );
    const order = orderResult.rows[0];
    if (!order) throw new CreditOperationError("Order not found", 404);
    if (order.organisation_id !== input.organisationId || order.site_id !== input.siteId) {
      throw new CreditOperationError("Order does not belong to the selected organisation and site", 403);
    }
    if (["cancelled", "cancellation_requested"].includes(order.status)) {
      throw new CreditOperationError("Payments cannot be registered for cancelled orders");
    }
    const remainingResult = await client.query(
      `SELECT GREATEST($1::numeric - COALESCE(SUM(amount), 0), 0)::text AS remaining
       FROM payments
       WHERE order_id = $2`,
      [order.total_amount, input.orderId],
    );
    order.remaining = remainingResult.rows[0].remaining;

    const customerResult = await client.query(
      `SELECT c.id, c.credit_balance, cs.organisation_id AS customer_organisation_id
       FROM customers c
       JOIN sites cs ON cs.id = c.site_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [order.customer_id],
    );
    const customer = customerResult.rows[0];
    if (!customer || customer.customer_organisation_id !== input.organisationId) {
      throw new CreditOperationError("Customer does not belong to this organisation", 403);
    }

    const calculation = await client.query(
      `SELECT
         $1::numeric AS amount_received,
         $2::numeric AS credit_requested,
         $3::numeric AS remaining,
         $4::numeric AS credit_balance,
         ($2::numeric <= LEAST($3::numeric, $4::numeric)) AS credit_is_valid,
         LEAST($1::numeric, GREATEST($3::numeric - $2::numeric, 0))::text AS cash_applied,
         GREATEST($1::numeric - GREATEST($3::numeric - $2::numeric, 0), 0)::text AS surplus,
         (LEAST($1::numeric, GREATEST($3::numeric - $2::numeric, 0)) > 0) AS cash_positive,
         ($2::numeric > 0) AS credit_positive,
         (GREATEST($1::numeric - GREATEST($3::numeric - $2::numeric, 0), 0) > 0) AS surplus_positive`,
      [input.amountReceived, input.creditToApply, order.remaining, customer.credit_balance],
    );
    const amounts = calculation.rows[0];
    if (!amounts.credit_is_valid) {
      throw new CreditOperationError("Requested credit exceeds the available credit or order balance");
    }
    if (!amounts.cash_positive && !amounts.credit_positive) {
      throw new CreditOperationError("Payment amount must be greater than zero");
    }

    let cashPayment: any = null;
    let creditPayment: any = null;
    if (amounts.cash_positive) {
      const result = await client.query(
        `INSERT INTO payments
          (order_id, collected_by_employee_id, amount, method, reference, date, is_advance, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         RETURNING *`,
        [
          input.orderId,
          input.collectedByEmployeeId,
          amounts.cash_applied,
          input.method,
          input.reference ?? null,
          input.paymentDate ?? new Date(),
          `${input.idempotencyKey}:cash`,
        ],
      );
      cashPayment = result.rows[0];
    }

    let currentBalance = customer.credit_balance as string;
    if (amounts.credit_positive) {
      const updated = await client.query(
        `UPDATE customers
         SET credit_balance = credit_balance - $1::numeric,
             total_credit_used = total_credit_used + $1::numeric
         WHERE id = $2 AND credit_balance >= $1::numeric
         RETURNING (credit_balance + $1::numeric)::text AS balance_before,
                   credit_balance::text AS balance_after`,
        [amounts.credit_requested, customer.id],
      );
      if (!updated.rowCount) throw new CreditOperationError("Insufficient customer credit");
      currentBalance = updated.rows[0].balance_after;

      const paymentResult = await client.query(
        `INSERT INTO payments
          (order_id, collected_by_employee_id, amount, method, reference, date, is_advance, idempotency_key)
         VALUES ($1, $2, $3, 'Client Credit', NULL, $4, false, $5)
         RETURNING *`,
        [
          input.orderId,
          input.collectedByEmployeeId,
          amounts.credit_requested,
          input.paymentDate ?? new Date(),
          `${input.idempotencyKey}:credit`,
        ],
      );
      creditPayment = paymentResult.rows[0];
      await client.query(
        `INSERT INTO credit_transactions
          (organisation_id, site_id, customer_id, order_id, payment_id, type, amount, reason,
           balance_before, balance_after, created_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, 'debit', $6, 'order_applied', $7, $8, $9, $10)`,
        [
          input.organisationId,
          input.siteId,
          customer.id,
          input.orderId,
          creditPayment.id,
          amounts.credit_requested,
          updated.rows[0].balance_before,
          updated.rows[0].balance_after,
          input.actorUserId,
          `${input.idempotencyKey}:debit`,
        ],
      );
    }

    let creditAdded = "0";
    if (input.surplusDisposition === "credit" && amounts.surplus_positive) {
      const updated = await client.query(
        `UPDATE customers
         SET credit_balance = credit_balance + $1::numeric,
             total_credit_added = total_credit_added + $1::numeric
         WHERE id = $2
         RETURNING (credit_balance - $1::numeric)::text AS balance_before,
                   credit_balance::text AS balance_after`,
        [amounts.surplus, customer.id],
      );
      currentBalance = updated.rows[0].balance_after;
      creditAdded = amounts.surplus;
      await client.query(
        `INSERT INTO credit_transactions
          (organisation_id, site_id, customer_id, order_id, payment_id, type, amount, reason,
           balance_before, balance_after, created_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, 'credit', $6, 'overpayment', $7, $8, $9, $10)`,
        [
          input.organisationId,
          input.siteId,
          customer.id,
          input.orderId,
          cashPayment?.id ?? creditPayment?.id ?? null,
          amounts.surplus,
          updated.rows[0].balance_before,
          updated.rows[0].balance_after,
          input.actorUserId,
          `${input.idempotencyKey}:surplus`,
        ],
      );
    }

    const statusResult = await client.query(
      `UPDATE orders
       SET payment_status = CASE
         WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = $1), 0) >= total_amount THEN 'paid'
         WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = $1), 0) > 0 THEN 'partial'
         ELSE 'unpaid'
       END
       WHERE id = $1
       RETURNING payment_status`,
      [input.orderId],
    );

    await client.query("COMMIT");
    return {
      ...(cashPayment ?? creditPayment),
      amountReceived: input.amountReceived,
      cashApplied: amounts.cash_applied,
      creditApplied: amounts.credit_requested,
      creditAdded,
      changeReturned: input.surplusDisposition === "return" ? amounts.surplus : "0",
      creditBalance: currentBalance,
      paymentStatus: statusResult.rows[0].payment_status,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addManualCredit(input: {
  customerId: number;
  amount: string;
  reason: typeof CREDIT_REASONS[number];
  notes?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  organisationId: number;
  siteId: number;
  actorUserId: string | null;
  idempotencyKey: string;
}) {
  assertMoney(input.amount, "amount", false);
  assertIdempotencyKey(input.idempotencyKey);
  if (input.reason === "compensation" && !input.notes?.trim()) {
    throw new CreditOperationError("A note is required for compensation credits");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT * FROM credit_transactions WHERE idempotency_key = $1",
      [`${input.idempotencyKey}:manual`],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return { ...existing.rows[0], idempotentReplay: true };
    }

    const customerResult = await client.query(
      `SELECT c.id, c.credit_balance, cs.organisation_id
       FROM customers c
       JOIN sites cs ON cs.id = c.site_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [input.customerId],
    );
    const customer = customerResult.rows[0];
    if (!customer) throw new CreditOperationError("Customer not found", 404);
    if (customer.organisation_id !== input.organisationId) {
      throw new CreditOperationError("Customer does not belong to this organisation", 403);
    }

    const updated = await client.query(
      `UPDATE customers
       SET credit_balance = credit_balance + $1::numeric,
           total_credit_added = total_credit_added + $1::numeric
       WHERE id = $2
       RETURNING (credit_balance - $1::numeric)::text AS balance_before,
                 credit_balance::text AS balance_after`,
      [input.amount, input.customerId],
    );
    const transaction = await client.query(
      `INSERT INTO credit_transactions
        (organisation_id, site_id, customer_id, type, amount, reason, balance_before,
         balance_after, notes, payment_method, reference, created_by, idempotency_key)
       VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.organisationId,
        input.siteId,
        input.customerId,
        input.amount,
        input.reason,
        updated.rows[0].balance_before,
        updated.rows[0].balance_after,
        input.notes?.trim() || null,
        input.paymentMethod?.trim() || null,
        input.reference?.trim() || null,
        input.actorUserId,
        `${input.idempotencyKey}:manual`,
      ],
    );
    await client.query("COMMIT");
    return transaction.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reverseCustomerDeposit(input: {
  transactionId: number; customerId: number; reason: string; organisationId: number;
  siteId: number; actorUserId: string | null; idempotencyKey: string;
}) {
  assertIdempotencyKey(input.idempotencyKey);
  if (input.reason.trim().length < 5) throw new CreditOperationError("A reversal reason of at least 5 characters is required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM credit_transactions WHERE idempotency_key = $1", [`${input.idempotencyKey}:reversal`]);
    if (existing.rowCount) { await client.query("COMMIT"); return { ...existing.rows[0], idempotentReplay: true }; }
    const originalResult = await client.query(
      `SELECT ct.*, s.organisation_id AS site_organisation_id FROM credit_transactions ct
       JOIN sites s ON s.id = ct.site_id WHERE ct.id = $1 AND ct.customer_id = $2 FOR UPDATE OF ct`,
      [input.transactionId, input.customerId],
    );
    const original = originalResult.rows[0];
    if (!original) throw new CreditOperationError("Deposit transaction not found", 404);
    if (original.site_organisation_id !== input.organisationId || original.organisation_id !== input.organisationId) throw new CreditOperationError("Deposit does not belong to this organisation", 403);
    if (original.type !== "credit" || original.reason !== "advance_payment" || original.reversal_of_id) throw new CreditOperationError("Only an original customer deposit can be reversed");
    const priorReversal = await client.query("SELECT id FROM credit_transactions WHERE reversal_of_id = $1", [original.id]);
    if (priorReversal.rowCount) throw new CreditOperationError("This deposit has already been reversed", 409);
    const updated = await client.query(
      `UPDATE customers SET credit_balance = credit_balance - $1::numeric
       WHERE id = $2 AND credit_balance >= $1::numeric
       RETURNING (credit_balance + $1::numeric)::text AS balance_before, credit_balance::text AS balance_after`,
      [original.amount, input.customerId],
    );
    if (!updated.rowCount) throw new CreditOperationError("This deposit cannot be reversed because the customer has already used some or all of the credit", 409);
    const reversal = await client.query(
      `INSERT INTO credit_transactions
        (organisation_id, site_id, customer_id, type, amount, reason, balance_before, balance_after,
         notes, payment_method, reference, created_by, idempotency_key, reversal_of_id)
       VALUES ($1, $2, $3, 'debit', $4, 'deposit_reversal', $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [input.organisationId, input.siteId, input.customerId, original.amount, updated.rows[0].balance_before,
       updated.rows[0].balance_after, input.reason.trim(), original.payment_method, original.reference,
       input.actorUserId, `${input.idempotencyKey}:reversal`, original.id],
    );
    await client.query("COMMIT");
    return reversal.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
