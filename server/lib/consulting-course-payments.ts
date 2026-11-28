import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { PAWAPAY_ENDPOINTS, saasEnvironment, type SaasMode } from "./saas-environment";

export function courseMode(env: NodeJS.ProcessEnv = process.env): SaasMode | null {
  if (env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT) return "sandbox";
  if (env.NODE_ENV === "production" && env.REPLIT_DEPLOYMENT === "1") return "live";
  return null;
}

// These table names come exclusively from the server-selected environment.
export function attemptsTable(mode: SaasMode) {
  return mode === "live" ? "consulting_course_live_attempts" : "consulting_course_sandbox_attempts";
}
function provider(mode: SaasMode) {
  if (mode !== courseMode()) throw Error("Course payment environment mismatch");
  if (mode === "live") {
    const billing = saasEnvironment();
    if (billing?.mode !== "live" || !billing.token || billing.returnOrigin !== "https://app.xpressclean.cm")
      throw Error("Live course payments unavailable");
    return { origin: billing.returnOrigin, token: billing.token };
  }
  const host = process.env.REPLIT_DEV_DOMAIN;
  const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
  if (!host || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.replit\.dev$/i.test(host) || !token)
    throw Error("Development course payments unavailable");
  return { origin: "https://" + host, token };
}
const openStatus = "PENDING";
export const coursePrice = 100_000;

type Attempt = { amount_xaf: number; checkout_id: string; status: string; checkout_code: string | null; redirect_url: string | null; lastAttemptFailed?: boolean };
type DB = Pick<Pool, "query">;
type Amount = { country?: string; currency?: string; amount?: string };
type Checkout = {
  checkoutId?: string; checkoutCode?: string; redirectUrl?: string; clientReferenceId?: string;
  status?: string; amounts?: Amount[]; deposit?: Amount & { status?: string };
};

function correctAmount(expected: number, amount?: Amount) {
  return amount?.country === "CMR" && amount.currency === "XAF" && /^\d+(?:\.0+)?$/.test(String(amount.amount)) && Number(amount.amount) === expected;
}

export function checkedStatus(id: string, code: string | null, data: Checkout, expectedAmount: number) {
  if (data.checkoutId !== id || data.clientReferenceId !== id || !data.checkoutCode ||
      (code && code !== data.checkoutCode) || !Array.isArray(data.amounts) ||
      data.amounts.length !== 1 || !correctAmount(expectedAmount, data.amounts[0])) throw Error("Course checkout mismatch");
  if (data.status === "COMPLETED") {
    if (data.deposit?.status !== "COMPLETED" || !correctAmount(expectedAmount, data.deposit)) throw Error("Course deposit mismatch");
    return "COMPLETED";
  }
  if (["FAILED","EXPIRED","CANCELLED"].includes(data.status ?? "")) return data.status!;
  return openStatus;
}

function redirectUrl(mode: SaasMode, value?: string) {
  const url = new URL(value ?? "");
  if (url.origin !== PAWAPAY_ENDPOINTS[mode].checkout || url.username || url.password) throw Error("Invalid checkout URL");
  return url.href;
}

async function call(mode: SaasMode, path: string, body?: object) {
  const { token } = provider(mode);
  const response = await fetch(PAWAPAY_ENDPOINTS[mode].api + "/v2/checkouts" + path, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw Error("Course payment service unavailable");
  return response.json();
}

export async function latestAttempt(db: DB, user: string, mode: SaasMode) {
  const result = await db.query<Attempt>(`SELECT * FROM ${attemptsTable(mode)} WHERE learner_id=$1 ORDER BY created_at DESC LIMIT 1`, [user]);
  return result.rows[0];
}

// A delayed response cannot replace a terminal result or update another attempt.
async function save(db: DB, mode: SaasMode, attempt: Attempt, status: string, code: string, redirect: string | null) {
  const result = await db.query<Attempt>(`UPDATE ${attemptsTable(mode)}
    SET status=$2, checkout_code=$3, redirect_url=COALESCE($4,redirect_url),
        confirmed_at=CASE WHEN $2='COMPLETED' THEN now() END
    WHERE checkout_id=$1 AND status='PENDING' AND (checkout_code IS NULL OR checkout_code=$3)
    RETURNING *`, [attempt.checkout_id, status, code, redirect]);
  if (result.rows[0]) return result.rows[0];
  const current = await db.query<Attempt>(`SELECT * FROM ${attemptsTable(mode)} WHERE checkout_id=$1`, [attempt.checkout_id]);
  if (!current.rows[0] || current.rows[0].checkout_code !== code) throw Error("Course attempt changed");
  return current.rows[0];
}

export async function refreshAttempt(db: DB, attempt: Attempt, mode: SaasMode) {
  if (attempt.status !== openStatus) return attempt;
  const result = await call(mode, "/" + attempt.checkout_id);
  if (result.status === "NOT_FOUND") return attempt;
  if (result.status !== "FOUND" || !result.data) throw Error("Unknown checkout");
  const data = result.data as Checkout;
  const status = checkedStatus(attempt.checkout_id, attempt.checkout_code, data, attempt.amount_xaf);
  const redirect = data.redirectUrl ? redirectUrl(mode,data.redirectUrl) : null;
  const unchanged = status === attempt.status && data.checkoutCode === attempt.checkout_code &&
    (!redirect || redirect === attempt.redirect_url);
  const updated = unchanged ? attempt : await save(db, mode, attempt, status, data.checkoutCode!, redirect);
  return { ...updated, lastAttemptFailed: updated.status === openStatus && data.deposit?.status === "FAILED" };
}

export async function startAttempt(db: DB, user: string, mode: SaasMode) {
  const { origin } = provider(mode);
  const inserted = await db.query<Attempt>(`INSERT INTO ${attemptsTable(mode)}(checkout_id,learner_id,status,amount_xaf)
    VALUES ($1,$2,'PENDING',$3) ON CONFLICT DO NOTHING RETURNING *`, [randomUUID(),user,coursePrice]);
  const attempt = inserted.rows[0] ?? await latestAttempt(db,user,mode);
  if (!attempt) throw Error("No course attempt");
  if (attempt.status !== openStatus) return attempt;
  if (!inserted.rowCount) {
    const current = await refreshAttempt(db,attempt,mode);
    if (current.status !== openStatus || current.redirect_url) return current;
  }
  const id = attempt.checkout_id;
  const data = await call(mode, "", { checkoutId:id, clientReferenceId:id, returnUrl:`${origin}/mes-formations`,
    defaultLanguage:"fr", countries:["CMR"], expiresAfter:15, amounts:[{country:"CMR",currency:"XAF",amount:String(attempt.amount_xaf)}],
    reason:{fr:"Formation pressing",en:"Pressing course"} });
  if (mode === "sandbox" && data.status === "REJECTED" && data.checkoutId === id) {
    const rejected = await db.query<Attempt>(`UPDATE ${attemptsTable(mode)} SET status='FAILED'
      WHERE checkout_id=$1 AND status='PENDING' AND checkout_code IS NULL RETURNING *`, [id]);
    if (rejected.rows[0]) return rejected.rows[0];
  }
  if (data.status !== "ACCEPTED" || data.checkoutId !== id || !data.checkoutCode) throw Error("Checkout not accepted");
  return save(db,mode,attempt,openStatus,data.checkoutCode,redirectUrl(mode,data.redirectUrl));
}
