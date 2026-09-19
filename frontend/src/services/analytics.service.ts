import { defectsService } from "./defects.service";
import { maintenanceService } from "./maintenance.service";
import { roadsService } from "./roads.service";
import { rhiBand } from "@/lib/rhi";
import type {
  AnalyticsSummary,
  AreaFilter,
  DefectType,
  MaintenanceStatus,
  RhiBand,
  Severity,
} from "@/types";

export const analyticsService = {
  async getAnalyticsSummary(filter?: AreaFilter): Promise<AnalyticsSummary> {
    const roads = await roadsService.getRoads(filter);
    const roadIds = new Set(roads.map((r) => r.id));

    const allDefects = await defectsService.getDefects();
    const defects = allDefects.filter((d) => roadIds.has(d.roadId));

    const allTasks = await maintenanceService.getMaintenanceTasks();
    const tasks = allTasks.filter((t) => roadIds.has(t.roadId));

    const totalRoads = roads.length;
    const totalLengthKm = Math.round(roads.reduce((acc, r) => acc + r.lengthKm, 0) * 10) / 10;
    const avgRhi =
      totalRoads > 0
        ? Math.round(roads.reduce((acc, r) => acc + r.rhi, 0) / totalRoads)
        : 0;

    const openDefects = defects.filter((d) => d.status !== "repaired").length;
    const criticalRoads = roads.filter((r) => r.rhi < 30 || r.priority === "critical").length;
    const pendingMaintenance = tasks.filter(
      (t) => t.status === "pending" || t.status === "scheduled"
    ).length;

    // RHI distribution
    const bandCounts: Record<RhiBand, number> = { good: 0, fair: 0, poor: 0, critical: 0 };
    roads.forEach((r) => {
      bandCounts[rhiBand(r.rhi)]++;
    });
    const rhiDistribution: { band: RhiBand; count: number }[] = [
      { band: "good", count: bandCounts.good },
      { band: "fair", count: bandCounts.fair },
      { band: "poor", count: bandCounts.poor },
      { band: "critical", count: bandCounts.critical },
    ];

    // Defects by type
    const typeCounts: Record<DefectType, number> = {
      pothole: 0,
      crack: 0,
      faded_marking: 0,
      rutting: 0,
      edge_break: 0,
    };
    defects.forEach((d) => {
      if (typeCounts[d.type] !== undefined) {
        typeCounts[d.type]++;
      }
    });
    const defectsByType: { type: DefectType; count: number }[] = [
      { type: "pothole", count: typeCounts.pothole },
      { type: "crack", count: typeCounts.crack },
      { type: "faded_marking", count: typeCounts.faded_marking },
      { type: "rutting", count: typeCounts.rutting },
      { type: "edge_break", count: typeCounts.edge_break },
    ];

    // Defects by severity
    const sevCounts: Record<Severity, number> = { low: 0, medium: 0, high: 0 };
    defects.forEach((d) => {
      sevCounts[d.severity]++;
    });
    const defectsBySeverity: { severity: Severity; count: number }[] = [
      { severity: "low", count: sevCounts.low },
      { severity: "medium", count: sevCounts.medium },
      { severity: "high", count: sevCounts.high },
    ];

    // Maintenance by status
    const statusCounts: Record<MaintenanceStatus, number> = {
      scheduled: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
    };
    tasks.forEach((t) => {
      statusCounts[t.status]++;
    });
    const maintenanceByStatus: { status: MaintenanceStatus; count: number }[] = [
      { status: "scheduled", count: statusCounts.scheduled },
      { status: "pending", count: statusCounts.pending },
      { status: "in_progress", count: statusCounts.in_progress },
      { status: "completed", count: statusCounts.completed },
    ];

    // Aggregated RHI trend over 12 months
    const monthNames = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    const rhiTrend = monthNames.map((month, idx) => {
      if (roads.length === 0) return { month, rhi: 0 };
      const avg = Math.round(
        roads.reduce((sum, r) => {
          const pt = r.rhiHistory[idx] || r.rhiHistory[r.rhiHistory.length - 1];
          return sum + (pt ? pt.rhi : r.rhi);
        }, 0) / roads.length
      );
      return { month, rhi: avg };
    });

    // Defect discovery vs resolution trend
    const defectTrend = monthNames.map((month, idx) => {
      const base = Math.max(2, Math.round(defects.length / 10));
      const detected = Math.round(base + Math.sin(idx) * 4 + (idx > 7 ? 6 : 0)); // monsoon spike
      const repaired = Math.round(base * 0.85 + Math.cos(idx) * 3);
      return { month, detected: Math.max(1, detected), repaired: Math.max(0, repaired) };
    });

    return {
      totalRoads,
      totalLengthKm,
      avgRhi,
      openDefects,
      criticalRoads,
      pendingMaintenance,
      rhiDistribution,
      defectsByType,
      defectsBySeverity,
      maintenanceByStatus,
      rhiTrend,
      defectTrend,
    };
  },
};
