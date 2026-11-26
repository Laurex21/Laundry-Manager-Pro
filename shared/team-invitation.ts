import { z } from "zod";
import { normalizeLoginIdentifier } from "./login-identifier";

/** International digits used by both phone sign-in and WhatsApp. */
export function invitationPhone(value: unknown): string | null {
  const id = normalizeLoginIdentifier(value);
  if (id?.kind !== "phone" || !/^[1-9]\d{7,14}$/.test(id.value)) return null;
  if (id.value.startsWith("237") && !/^237[26]\d{8}$/.test(id.value)) return null;
  return id.value;
}

export const invitationEmail = z.string().trim().max(254).email().toLowerCase();

export const newTeamInvitation = z.object({
  siteId: z.coerce.number().int().positive(),
  role: z.enum(["manager", "operator"]),
  identifier: invitationEmail,
  notificationPhone: z.string().trim().nullish().transform((value, ctx) => {
    if (!value) return null;
    const phone = invitationPhone(value);
    if (phone) return phone;
    ctx.addIssue({ code: "custom", message: "Invalid WhatsApp number" });
    return z.NEVER;
  }),
});

export function invitationWhatsAppRecipient(invitation: { identifier: string; notificationPhone?: string | null }) {
  // Invitations issued before email was restored used the phone as the identifier.
  return invitationPhone(invitation.notificationPhone ?? invitation.identifier);
}

export function matchingInvitationCredential(invited: string, account: { email?: unknown; phone?: unknown }) {
  const expected = normalizeLoginIdentifier(invited);
  if (!expected) return null;
  const actual = normalizeLoginIdentifier(account[expected.kind]);
  return actual?.kind === expected.kind && actual.value === expected.value ? expected : null;
}
