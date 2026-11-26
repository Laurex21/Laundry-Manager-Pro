import { normalizeLoginIdentifier } from "./login-identifier";

/** International digits used by both phone sign-in and WhatsApp. */
export function invitationPhone(value: unknown): string | null {
  const id = normalizeLoginIdentifier(value);
  if (id?.kind !== "phone" || !/^[1-9]\d{7,14}$/.test(id.value)) return null;
  if (id.value.startsWith("237") && !/^237[26]\d{8}$/.test(id.value)) return null;
  return id.value;
}

export function matchingInvitationCredential(invited: string, account: { email?: unknown; phone?: unknown }) {
  const expected = normalizeLoginIdentifier(invited);
  if (!expected) return null;
  const actual = normalizeLoginIdentifier(account[expected.kind]);
  return actual?.kind === expected.kind && actual.value === expected.value ? expected : null;
}
