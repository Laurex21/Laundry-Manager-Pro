const DECIMAL_PATTERN = /^[+-]?(?:\d+)(?:[.,]\d+)?$/;

export function normalizeDecimalInput(value: string | number, maxScale = 6): string {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!DECIMAL_PATTERN.test(raw)) throw new Error("Invalid decimal value");
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  const [wholeRaw, fractionRaw = ""] = unsigned.split(".");
  if (fractionRaw.length > maxScale) throw new Error(`Maximum ${maxScale} decimal places allowed`);
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionRaw.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function parts(value: string | number) {
  const normalized = normalizeDecimalInput(value);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length, negative };
}

function serialize(integer: bigint, scale: number, negative = false): string {
  const digits = integer.toString().padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, "") : "";
  const prefix = negative && integer !== 0n ? "-" : "";
  return `${prefix}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function multiplyDecimal(left: string | number, right: string | number): string {
  const a = parts(left);
  const b = parts(right);
  return serialize(a.integer * b.integer, a.scale + b.scale, a.negative !== b.negative);
}

export function addDecimals(...values: Array<string | number>): string {
  const parsed = values.map(parts);
  const scale = Math.max(0, ...parsed.map((value) => value.scale));
  const total = parsed.reduce((sum, value) => {
    const scaled = value.integer * (10n ** BigInt(scale - value.scale));
    return sum + (value.negative ? -scaled : scaled);
  }, 0n);
  return serialize(total < 0n ? -total : total, scale, total < 0n);
}

export function compareDecimals(left: string | number, right: string | number): number {
  const difference = addDecimals(left, multiplyDecimal(right, "-1"));
  return difference.startsWith("-") ? -1 : difference === "0" ? 0 : 1;
}

export function isIntegerDecimal(value: string | number): boolean {
  return !normalizeDecimalInput(value).includes(".");
}

export function formatExactDecimal(value: string | number, locale = "fr-FR"): string {
  const normalized = normalizeDecimalInput(value);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer, fraction] = unsigned.split(".");
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(integer || "0"));
  if (!fraction) return `${negative ? "-" : ""}${grouped}`;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value || ".";
  return `${negative ? "-" : ""}${grouped}${separator}${fraction}`;
}

export function formatExactMoney(value: string | number, symbol: string, locale = "fr-FR"): string {
  const amount = formatExactDecimal(value, locale);
  return locale.toLowerCase().startsWith("en") ? `${symbol}${amount}` : `${amount} ${symbol}`;
}
