import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

const sandbox = "https://api.sandbox.pawapay.io/v2/checkouts";
const openStatus = "PENDING";
export const coursePrice = 100;

type Attempt = { checkout_id: string; status: string; checkout_code: string | null; redirect_url: string | null; lastAttemptFailed?: boolean };
type DB = Pick<Pool, "query">;
type Amount = { country?: string; currency?: string; amount?: string };
type Checkout = {
  checkoutId?: string; checkoutCode?: string; redirectUrl?: string; clientReferenceId?: string;
  status?: string; amounts?: Amount[]; deposit?: Amount & { status?: string };
};

function correctAmount(amount?: Amount) {
  return amount?.country === "CMR" && amount.currency === "XAF" && /^100(?:\.0+)?$/.test(String(amount.amount));
}

export function checkedStatus(id: string, code: string | null, data: Checkout) {
  if (data.checkoutId !== id || data.clientReferenceId !== id || !data.checkoutCode ||
      (code && code !== data.checkoutCode) || !Array.isArray(data.amounts) ||
      data.amounts.length !== 1 || !correctAmount(data.amounts[0])) throw Error("Course checkout mismatch");
  if (data.status === "COMPLETED") {
    if (data.deposit?.status !== "COMPLETED" || !correctAmount(data.deposit)) throw Error("Course deposit mismatch");
    return "COMPLETED";
  }
  if (["FAILED","EXPIRED","CANCELLED"].includes(data.status ?? "")) return data.status!;
  return openStatus;
}

function redirectUrl(value?: string) {
  const url = new URL(value ?? "");
  if (url.origin !== "https://checkout.sandbox.pawapay.io" || url.username || url.password) throw Error("Invalid sandbox URL");
  return url.href;
}

async function call(path: string, body?: object) {
  const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
  if (!token || process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) throw Error("Sandbox unavailable");
  const response = await fetch(sandbox + path, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw Error("Sandbox service unavailable");
  return response.json();
}

export async function latestAttempt(db: DB, user: string) {
  const result = await db.query<Attempt>("SELECT * FROM consulting_course_sandbox_attempts WHERE learner_id=$1 ORDER BY created_at DESC LIMIT 1", [user]);
  return result.rows[0];
}

// A delayed response cannot replace a terminal result or update another attempt.
async function save(db: DB, attempt: Attempt, status: string, code: string, redirect: string | null) {
  const result = await db.query<Attempt>(`UPDATE consulting_course_sandbox_attempts
    SET status=$2, checkout_code=$3, redirect_url=COALESCE($4,redirect_url),
        confirmed_at=CASE WHEN $2='COMPLETED' THEN now() END
    WHERE checkout_id=$1 AND status='PENDING' AND (checkout_code IS NULL OR checkout_code=$3)
    RETURNING *`, [attempt.checkout_id, status, code, redirect]);
  if (result.rows[0]) return result.rows[0];
  const current = await db.query<Attempt>("SELECT * FROM consulting_course_sandbox_attempts WHERE checkout_id=$1", [attempt.checkout_id]);
  if (!current.rows[0] || current.rows[0].checkout_code !== code) throw Error("Course attempt changed");
  return current.rows[0];
}

export async function refreshAttempt(db: DB, attempt: Attempt) {
  if (attempt.status !== openStatus) return attempt;
  const result = await call("/" + attempt.checkout_id);
  if (result.status === "NOT_FOUND") return attempt;
  if (result.status !== "FOUND" || !result.data) throw Error("Unknown checkout");
  const data = result.data as Checkout;
  const status = checkedStatus(attempt.checkout_id, attempt.checkout_code, data);
  const redirect = data.redirectUrl ? redirectUrl(data.redirectUrl) : null;
  const unchanged = status === attempt.status && data.checkoutCode === attempt.checkout_code &&
    (!redirect || redirect === attempt.redirect_url);
  const updated = unchanged ? attempt : await save(db, attempt, status, data.checkoutCode!, redirect);
  return { ...updated, lastAttemptFailed: updated.status === openStatus && data.deposit?.status === "FAILED" };
}

export async function startAttempt(db: DB, user: string) {
  const host = process.env.REPLIT_DEV_DOMAIN;
  if (!host || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.replit\.dev$/i.test(host) || !process.env.PAWAPAY_SANDBOX_API_TOKEN)
    throw Error("Development sandbox not configured");
  const inserted = await db.query<Attempt>(`INSERT INTO consulting_course_sandbox_attempts(checkout_id,learner_id,status)
    VALUES ($1,$2,'PENDING') ON CONFLICT DO NOTHING RETURNING *`, [randomUUID(),user]);
  const attempt = inserted.rows[0] ?? await latestAttempt(db,user);
  if (!attempt) throw Error("No course attempt");
  if (attempt.status !== openStatus) return attempt;
  if (!inserted.rowCount) {
    const current = await refreshAttempt(db,attempt);
    if (current.status !== openStatus || current.redirect_url) return current;
  }
  const id = attempt.checkout_id;
  const data = await call("", { checkoutId:id, clientReferenceId:id, returnUrl:`https://${host}/mes-formations`,
    defaultLanguage:"fr", countries:["CMR"], expiresAfter:15, amounts:[{country:"CMR",currency:"XAF",amount:String(coursePrice)}],
    reason:{fr:"Formation pressing",en:"Pressing course"} });
  if (data.status === "REJECTED" && data.checkoutId === id) {
    const rejected = await db.query<Attempt>(`UPDATE consulting_course_sandbox_attempts SET status='FAILED'
      WHERE checkout_id=$1 AND status='PENDING' AND checkout_code IS NULL RETURNING *`, [id]);
    if (rejected.rows[0]) return rejected.rows[0];
  }
  if (data.status !== "ACCEPTED" || data.checkoutId !== id || !data.checkoutCode) throw Error("Checkout not accepted");
  return save(db,attempt,openStatus,data.checkoutCode,redirectUrl(data.redirectUrl));
}
