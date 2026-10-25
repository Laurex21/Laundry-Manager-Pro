// Human-readable reference only: access control always uses the internal order ID.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createOrderReference(id: number, siteName: string, createdAt: Date): string {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new Error("Invalid order ID");
  const words = siteName.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/PRESSING/g, " PRESSING ").replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const prefix = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "XP").slice(0, 2)).padEnd(2, "X");
  const year = new Intl.DateTimeFormat("en", { timeZone: "Africa/Douala", year: "2-digit" }).format(createdAt);
  // Odd multiplication is a bijection modulo 2^32. No collisions for serial IDs,
  // even between sites with identical initials, without a random retry race.
  let value = (BigInt(id) * 2654435761n) % (2n ** 32n);
  let suffix = "";
  for (let i = 0; i < 7; i++) { suffix = ALPHABET[Number(value % 32n)] + suffix; value /= 32n; }
  return `${prefix}-${year}-${suffix}`;
}
