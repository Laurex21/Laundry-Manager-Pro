import { canonicalMoney, fingerprintRequest, OrderMoneyConflictError, subtractMoney } from "./order-money";

export type PaymentOperationInput = {
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

function paymentFingerprint(input: PaymentOperationInput, amount: string, method: string) {
  return fingerprintRequest({
    orderId: input.orderId,
    amount,
    method,
    reference: method === "Client Credit" ? null : input.reference ?? null,
    paymentDate: input.paymentDate?.toISOString() ?? null,
    isAdvance: false,
    context: {
      amountReceived: input.amountReceived,
      creditToApply: input.creditToApply,
      surplusDisposition: input.surplusDisposition,
    },
  }, { moneyPaths: ["amount", "context.amountReceived", "context.creditToApply"] });
}

export async function findCompositePaymentReplay(
  client: { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> },
  input: PaymentOperationInput,
  customerCreditBalance: string,
  paymentStatus: string,
) {
  const existing = await client.query(
    `SELECT * FROM payments
     WHERE organisation_id = $1 AND site_id = $2
       AND idempotency_key IN ($3, $4)
     ORDER BY id`,
    [input.organisationId, input.siteId, `${input.idempotencyKey}:cash`, `${input.idempotencyKey}:credit`],
  );
  if (!existing.rowCount) return null;

  const byKey = new Map(existing.rows.map((payment) => [payment.idempotency_key, payment]));
  const cashPayment = byKey.get(`${input.idempotencyKey}:cash`);
  const creditPayment = byKey.get(`${input.idempotencyKey}:credit`);
  for (const [payment, method] of [[cashPayment, input.method], [creditPayment, "Client Credit"]] as const) {
    if (payment && payment.request_fingerprint !== paymentFingerprint(input, payment.amount, method)) {
      throw new OrderMoneyConflictError("Idempotency key was already used with a different composite payment request");
    }
  }

  const creditTransactions = await client.query(
    `SELECT type, amount FROM credit_transactions
     WHERE organisation_id = $1 AND site_id = $2
       AND idempotency_key IN ($3, $4)`,
    [input.organisationId, input.siteId, `${input.idempotencyKey}:debit`, `${input.idempotencyKey}:surplus`],
  );
  const debit = creditTransactions.rows.find((entry) => entry.type === "debit");
  const surplus = creditTransactions.rows.find((entry) => entry.type === "credit");
  const expectedCredit = canonicalMoney(input.creditToApply);
  if ((creditPayment?.amount ? canonicalMoney(creditPayment.amount) : "0.00") !== expectedCredit || Boolean(debit) !== (expectedCredit !== "0.00")) {
    throw new OrderMoneyConflictError("Idempotency key was already used with a different composite payment request");
  }
  if (input.surplusDisposition === "return" && surplus) {
    throw new OrderMoneyConflictError("Idempotency key was already used with a different composite payment request");
  }

  const cashApplied = cashPayment?.amount ? canonicalMoney(cashPayment.amount) : "0.00";
  const creditAdded = surplus?.amount ? canonicalMoney(surplus.amount) : "0.00";
  return {
    ...(cashPayment ?? creditPayment),
    amountReceived: canonicalMoney(input.amountReceived),
    cashApplied,
    creditApplied: expectedCredit,
    creditAdded,
    changeReturned: input.surplusDisposition === "return" ? subtractMoney(input.amountReceived, cashApplied) : "0.00",
    creditBalance: canonicalMoney(customerCreditBalance),
    paymentStatus,
    idempotentReplay: true,
  };
}
