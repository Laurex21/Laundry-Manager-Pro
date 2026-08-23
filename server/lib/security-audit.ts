import crypto from "crypto";
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";

type AuditInput = {
  req: Request;
  organisationId: number;
  siteId?: number | null;
  action: string;
  targetType: string;
  targetId?: string | number | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
};

function auditIpHash(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(ip).digest("hex");
}

export async function recordSecurityAudit(input: AuditInput, executor: any = db): Promise<void> {
  const actorUserId = String((input.req.session as any)?.userId || "");
  if (!actorUserId) throw new Error("Security audit requires an authenticated actor");
  await executor.execute(sql`
    INSERT INTO security_audit_events
      (organisation_id, site_id, actor_user_id, action, target_type, target_id,
       before_state, after_state, request_id, ip_hash, user_agent)
     VALUES (
       ${input.organisationId},
       ${input.siteId ?? null},
       ${actorUserId},
       ${input.action},
       ${input.targetType},
       ${input.targetId == null ? null : String(input.targetId)},
       ${JSON.stringify(input.beforeState ?? null)}::jsonb,
       ${JSON.stringify(input.afterState ?? null)}::jsonb,
       ${String((input.req as any).requestId || "")},
       ${auditIpHash(input.req)},
       ${String(input.req.get("user-agent") || "").slice(0, 500)}
     )
  `);
}
