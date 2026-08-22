import { z } from "zod";

function jsonDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") return depth;
  if (depth > 6) return depth;
  const values = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return values.reduce((max, item) => Math.max(max, jsonDepth(item, depth + 1)), depth);
}

export const boundedJsonObject = z.record(z.unknown())
  .refine((value) => jsonDepth(value) <= 6, "Payload is nested too deeply")
  .refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= 64 * 1024, "Payload is too large");
