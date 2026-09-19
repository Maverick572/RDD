import type { DefectType, MaintenanceStatus, Priority, RhiBand, Severity } from "@/types";

export function rhiBand(rhi: number): RhiBand {
  if (rhi >= 75) return "good";
  if (rhi >= 50) return "fair";
  if (rhi >= 30) return "poor";
  return "critical";
}

export const RHI_BAND_LABEL: Record<RhiBand, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  critical: "Critical",
};

/** Hex values mirror --rhi-* tokens in styles.css (Leaflet needs plain strings). */
export const RHI_HEX: Record<RhiBand, string> = {
  good: "#2f9e5f",
  fair: "#d9a520",
  poor: "#d9702a",
  critical: "#c1392b",
};

export const RHI_TEXT_CLASS: Record<RhiBand, string> = {
  good: "text-rhi-good",
  fair: "text-rhi-fair",
  poor: "text-rhi-poor",
  critical: "text-rhi-critical",
};

export const RHI_BG_CLASS: Record<RhiBand, string> = {
  good: "bg-rhi-good",
  fair: "bg-rhi-fair",
  poor: "bg-rhi-poor",
  critical: "bg-rhi-critical",
};

export const DEFECT_LABEL: Record<DefectType, string> = {
  pothole: "Pothole",
  crack: "Crack",
  faded_marking: "Faded marking",
  rutting: "Rutting",
  edge_break: "Edge break",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const MAINT_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  scheduled: "Scheduled",
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
