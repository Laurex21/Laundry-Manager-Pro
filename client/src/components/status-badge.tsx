import { cn } from "@/lib/utils";

type StatusType = "received" | "washing" | "stain_treatment" | "drying" | "ironing" | "ready" | "delivered" | "cancelled" | "pending" | "processing" | "paid" | "unpaid" | "partial";

const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  received: { label: "Received", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800" },
  pending: { label: "Received", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800" },
  washing: { label: "Washing", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  processing: { label: "Washing", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  stain_treatment: { label: "Stain Treatment", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
  drying: { label: "Drying", className: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800" },
  ironing: { label: "Ironing", className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800" },
  ready: { label: "Ready", className: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
  unpaid: { label: "Unpaid", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" },
  partial: { label: "Partial", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800" },
};

export function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase() as StatusType;
  const config = STATUS_CONFIG[normalizedStatus] || { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border inline-flex items-center", config.className)}>
      {config.label}
    </span>
  );
}
