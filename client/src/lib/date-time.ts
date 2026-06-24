import { format } from "date-fns";

export function formatBusinessDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy • HH'h'mm");
}
