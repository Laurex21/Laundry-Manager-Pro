import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { legalAcceptances, type LegalAcceptance } from "@shared/schema";

export const CURRENT_LEGAL_DOCUMENTS = {
  termsVersion: "1.0-enterprise-2026-06-30",
  privacyVersion: "1.0-2026-06-30",
  cookieVersion: "1.0-2026-06-30",
  effectiveDate: "2026-06-30",
  documentHash: "bf7328dc39d69b2d8691d92553c04c92998fe6512eaa461a97c3a86bbc521e39",
  fullDocumentUrl: "/legal/XPRESSPRO_TERMS_OF_SERVICE_UPDATED_LEGAL_COOKIE_2026-06-30.docx",
  documents: [
    {
      type: "terms",
      title: "XpressPro Terms of Service",
      version: "1.0-enterprise-2026-06-30",
      url: "/terms",
    },
    {
      type: "privacy",
      title: "XpressPro Privacy Policy",
      version: "1.0-2026-06-30",
      url: "/privacy",
    },
    {
      type: "cookies",
      title: "XpressPro Cookie Policy",
      version: "1.0-2026-06-30",
      url: "/cookies",
    },
  ],
} as const;

export type LegalAcceptanceStatus = {
  required: boolean;
  acceptedAt: Date | null;
  current: typeof CURRENT_LEGAL_DOCUMENTS;
};

export async function getCurrentLegalAcceptance(userId: string): Promise<LegalAcceptance | null> {
  const [acceptance] = await db
    .select()
    .from(legalAcceptances)
    .where(and(
      eq(legalAcceptances.userId, userId),
      eq(legalAcceptances.termsVersion, CURRENT_LEGAL_DOCUMENTS.termsVersion),
      eq(legalAcceptances.privacyVersion, CURRENT_LEGAL_DOCUMENTS.privacyVersion),
      eq(legalAcceptances.cookieVersion, CURRENT_LEGAL_DOCUMENTS.cookieVersion),
      eq(legalAcceptances.documentHash, CURRENT_LEGAL_DOCUMENTS.documentHash),
    ))
    .orderBy(desc(legalAcceptances.acceptedAt))
    .limit(1);

  return acceptance ?? null;
}

export async function getCurrentLegalAcceptanceStatus(userId: string): Promise<LegalAcceptanceStatus> {
  const acceptance = await getCurrentLegalAcceptance(userId);
  return {
    required: !acceptance,
    acceptedAt: acceptance?.acceptedAt ?? null,
    current: CURRENT_LEGAL_DOCUMENTS,
  };
}

export async function recordCurrentLegalAcceptance(data: {
  userId: string;
  organisationId?: number | null;
  siteId?: number | null;
  source: "registration" | "login_gate" | "staff_onboarding" | "admin";
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<LegalAcceptance> {
  const [acceptance] = await db
    .insert(legalAcceptances)
    .values({
      userId: data.userId,
      organisationId: data.organisationId ?? null,
      siteId: data.siteId ?? null,
      termsVersion: CURRENT_LEGAL_DOCUMENTS.termsVersion,
      privacyVersion: CURRENT_LEGAL_DOCUMENTS.privacyVersion,
      cookieVersion: CURRENT_LEGAL_DOCUMENTS.cookieVersion,
      documentHash: CURRENT_LEGAL_DOCUMENTS.documentHash,
      source: data.source,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      metadata: data.metadata ?? {},
    })
    .returning();

  return acceptance;
}

export function clientIp(req: any): string | null {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || req.ip || req.socket?.remoteAddress || null;
}
