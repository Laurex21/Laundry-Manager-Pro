import {
  CheckCircle2,
  Droplets,
  Package,
  PackageCheck,
  Shirt,
  Truck,
  Wind,
} from "lucide-react";

export const PRODUCTION_STAGE_KEYS = [
  "received",
  "sorting",
  "washing",
  "drying",
  "ironing",
  "packaging",
  "ready",
  "delivered",
] as const;

export type ProductionStageKey = typeof PRODUCTION_STAGE_KEYS[number];

export const MACHINE_STAGE_KEYS = ["washing", "drying", "ironing"] as const;

export function normalizeProductionStatus(status: string | null | undefined): ProductionStageKey | string {
  if (status === "stain_treatment") return "sorting";
  if (status === "pending" || status === "processing") return "received";
  return status || "received";
}

export function isMachineStage(status: string | null | undefined) {
  return MACHINE_STAGE_KEYS.includes(normalizeProductionStatus(status) as any);
}

export const PRODUCTION_STAGES = [
  { key: "received", icon: Package, color: "text-yellow-600" },
  { key: "sorting", icon: PackageCheck, color: "text-amber-600" },
  { key: "washing", icon: Droplets, color: "text-blue-600" },
  { key: "drying", icon: Wind, color: "text-cyan-600" },
  { key: "ironing", icon: Shirt, color: "text-violet-600" },
  { key: "packaging", icon: PackageCheck, color: "text-indigo-600" },
  { key: "ready", icon: CheckCircle2, color: "text-emerald-600" },
  { key: "delivered", icon: Truck, color: "text-green-600" },
] as const;
