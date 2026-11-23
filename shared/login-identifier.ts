import { normalizeLoginEmail } from "./login-email";

export const LOGIN_PHONE_SEPARATORS = " .()-\t\r\n\u00a0\u202f";

function normalizeLoginPhone(value: string): string | null {
  if (value.length > 80) return null;
  const compact = Array.from(value).filter(char => !LOGIN_PHONE_SEPARATORS.includes(char)).join("");
  if (!/^\+?\d+$/.test(compact)) return null;
  const digits = compact.replace(/^\+|^00(?=[1-9])/, "");
  if (!/^\d{7,15}$/.test(digits)) return null;
  return /^[26]\d{8}$/.test(digits) ? `237${digits}` : digits;
}

export function normalizeLoginIdentifier(value: unknown) {
  if (typeof value !== "string") return null;
  const email = normalizeLoginEmail(value);
  if (email) return { kind: "email" as const, value: email };
  const phone = normalizeLoginPhone(value);
  return phone ? { kind: "phone" as const, value: phone } : null;
}

/** Storage formats matched by a canonical phone identifier. */
export function loginPhoneAliases(phone: string): string[] {
  const aliases = [phone, `+${phone}`, `00${phone}`];
  if (/^237[26]\d{8}$/.test(phone)) {
    const national = phone.slice(3);
    aliases.push(national, `+${national}`, `00${national}`);
  }
  return aliases;
}
