import type { SparePart } from "@/lib/api";

export const EQUIPMENT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "rolling_mill_motor", label: "Rolling Mill Motor" },
  { value: "blast_furnace_blower", label: "Blast Furnace Blower" },
  { value: "blast_furnace_pump", label: "Blast Furnace Pump" },
  { value: "conveyor_system", label: "Conveyor System" },
  { value: "overhead_crane", label: "Overhead Crane" },
  { value: "general", label: "General / Plant-wide" },
] as const;

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

export type StockStatus = "healthy" | "low_stock" | "out_of_stock";

export function stockStatus(part: SparePart): StockStatus {
  if (part.quantity_available <= 0) return "out_of_stock";
  if (part.quantity_available < part.minimum_stock) return "low_stock";
  return "healthy";
}

export function stockFillPercent(part: SparePart): number {
  if (part.minimum_stock <= 0) return 100;
  return Math.min(100, Math.round((part.quantity_available / part.minimum_stock) * 100));
}

export function recommendQty(part: SparePart): number {
  return Math.max(1, part.minimum_stock - part.quantity_available + 1);
}

export function stockBadgeClass(status: StockStatus): string {
  if (status === "out_of_stock") return "bg-status-critical/15 text-status-critical";
  if (status === "low_stock") return "bg-status-warning/15 text-status-warning";
  return "bg-status-healthy/15 text-status-healthy";
}

export function stockLabel(status: StockStatus): string {
  if (status === "out_of_stock") return "Out of stock";
  if (status === "low_stock") return "Low stock";
  return "In stock";
}

export function urgencyClass(urgency: string): string {
  const u = urgency.toLowerCase();
  if (u === "critical") return "bg-status-critical/15 text-status-critical";
  if (u === "high") return "bg-status-warning/15 text-status-warning";
  return "bg-steel-500/15 text-steel-300";
}

export const QUICK_RESTOCK_PARTS = [
  { code: "BRG-BFB-220", label: "Blower bearing kit" },
  { code: "BRG-RMM-450", label: "Motor bearing" },
  { code: "SEAL-BFP-12", label: "Pump seal kit" },
  { code: "BELT-CV-90", label: "Conveyor belt" },
];
