import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Images,
  Layers,
  MapPin,
  Route as RouteIcon,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { RoadGisMap } from "@/components/map/RoadGisMap";
import { DefectDetailModal } from "@/components/defects/DefectDetailModal";
import { MaintenanceModal } from "@/components/maintenance/MaintenanceModal";
import { PriorityBadge, RhiBadge } from "@/components/road/RhiBadge";
import { DEFECT_LABEL, formatDate, rhiBand, RHI_HEX, SEVERITY_LABEL } from "@/lib/rhi";
import { defectsService } from "@/services/defects.service";
import { maintenanceService } from "@/services/maintenance.service";
import { roadsService } from "@/services/roads.service";
import type { Defect, DefectStatus, Inspection, MaintenanceTask, Road, RoadImage } from "@/types";

export const Route = createFileRoute("/roads/$id")({
  component: RoadDetailPage,
});

function RoadDetailPage() {
  const { id } = useParams({ from: "/roads/$id" });
  const [road, setRoad] = useState<Road | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [images, setImages] = useState<RoadImage[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRoadData = async () => {
    setLoading(true);
    try {
      const roadData = await roadsService.getRoadById(id);
      if (!roadData) return;

      const [defectsData, inspectionsData, tasksData, imagesData] = await Promise.all([
        defectsService.getDefects({ roadId: roadData.id }),
        roadsService.getInspections(roadData.id),
        maintenanceService.getMaintenanceTasks({ roadId: roadData.id }),
        roadsService.getRoadImages(roadData.id),
      ]);

      setRoad(roadData);
      setDefects(defectsData);
      setInspections(inspectionsData);
      setMaintenanceTasks(tasksData);
      setImages(imagesData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoadData();
  }, [id]);

  const handleUpdateDefectStatus = async (defectId: string, status: DefectStatus) => {
    await defectsService.updateDefectStatus(defectId, status);
    const updatedDefects = await defectsService.getDefects({ roadId: id });
    setDefects(updatedDefects);
    if (selectedDefect && selectedDefect.id === defectId) {
      setSelectedDefect({ ...selectedDefect, status });
    }
  };

  const handleCreateMaintenance = async (task: Omit<MaintenanceTask, "id">) => {
    await maintenanceService.createMaintenanceTask(task);
    await loadRoadData();
  };

  if (loading && !road) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="mt-3 text-xs text-muted-foreground font-mono">
              Loading corridor telemetry for {id}...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!road) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <h2 className="text-lg font-bold text-foreground">Corridor Not Found</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No road corridor matching ID '{id}' was located in GIS inventory.
          </p>
          <Link
            to="/roads"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Road Network
          </Link>
        </div>
      </AppShell>
    );
  }

  const band = rhiBand(road.rhi);
  const color = RHI_HEX[band];

  return (
    <AppShell
      title={`${road.code} — ${road.name}`}
      subtitle={`${road.category} • ${road.surface} • ${road.lengthKm} km • ${road.lanes} Lanes`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/gallery"
            search={{ roadId: road.id }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Images className="h-3.5 w-3.5 text-primary" />
            <span>Inspection Imagery</span>
          </Link>
          <button
            onClick={() => setScheduleModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Schedule Work</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5 p-4 lg:p-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/roads" className="hover:text-foreground flex items-center gap-1">
            <RouteIcon className="h-3.5 w-3.5" /> Road Corridors
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-mono text-foreground font-semibold">{road.code}</span>
        </div>

        {/* Top Health Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Health Index Card */}
          <div className="panel p-4 border-l-4" style={{ borderLeftColor: color }}>
            <span className="label-caps">Road Health Index (RHI)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono" style={{ color }}>
                {road.rhi}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-1">
              <RhiBadge rhi={road.rhi} size="sm" />
            </div>
          </div>

          {/* Distress Count Card */}
          <div className="panel p-4">
            <span className="label-caps">AI Distress Detections</span>
            <div className="mt-1 text-3xl font-bold font-mono text-foreground">
              {road.defectCount}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {defects.filter((d) => d.status === "open").length} open, {defects.filter((d) => d.status === "repaired").length} repaired
            </div>
          </div>

          {/* Priority Level */}
          <div className="panel p-4">
            <span className="label-caps">Intervention Priority</span>
            <div className="mt-1">
              <PriorityBadge priority={road.priority} className="text-sm px-2.5 py-1" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Calculated from distress density
            </div>
          </div>

          {/* Next Inspection */}
          <div className="panel p-4">
            <span className="label-caps">Inspection Schedule</span>
            <div className="mt-1 text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span>Next: {formatDate(road.nextInspection)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Last: {formatDate(road.lastInspection)}
            </div>
          </div>
        </div>

        {/* Middle Section: GIS Map & 12-Month RHI Line Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Corridor GIS Polyline Map */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Corridor Alignment & Defect Geo-Locations
                  </h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  Ch. 0.0 → {road.lengthKm} km
                </span>
              </div>

              <div className="mt-3">
                <RoadGisMap
                  roads={[road]}
                  defects={defects}
                  selectedRoadId={road.id}
                  height="h-[340px]"
                  showDefectMarkers={true}
                />
              </div>
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Markers represent AI-identified pavement distress</span>
              <span className="font-mono">{defects.length} markers</span>
            </div>
          </div>

          {/* 12-Month RHI Degradation Progression Chart */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    12-Month Health Progression History
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  Surveillance Trend
                </span>
              </div>

              <div className="mt-3 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={road.rhiHistory}
                    margin={{ top: 20, right: 20, left: -10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(d) => {
                        const date = new Date(d);
                        return date.toLocaleDateString("en-IN", { month: "short" });
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${value} RHI`, "Health Score"]}
                      labelFormatter={(l) => formatDate(String(l))}
                    />
                    <Line
                      type="monotone"
                      dataKey="rhi"
                      stroke={color}
                      strokeWidth={3}
                      dot={{ r: 4, fill: color }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Historical progression computed from monthly vehicle pass runs</span>
              <span className="font-mono text-foreground font-semibold">Latest: {road.rhi}</span>
            </div>
          </div>
        </div>

        {/* Lower Section: Defect Registry for this Road & Maintenance Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Defect List Along Chainage (2 cols) */}
          <div className="panel p-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  Pavement Distress Log by Chainage
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {defects.length} detected items
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2">ID / Type</th>
                    <th className="px-3 py-2">Chainage (km)</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {defects.map((defect) => (
                    <tr
                      key={defect.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-bold text-foreground block">
                          {defect.id}
                        </span>
                        <span className="text-xs text-foreground/90 font-medium">
                          {DEFECT_LABEL[defect.type]}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 font-mono font-medium text-foreground">
                        Ch. {defect.chainageKm} km
                      </td>

                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            defect.severity === "high"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : defect.severity === "medium"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {SEVERITY_LABEL[defect.severity]}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {Math.round(defect.confidence * 100)}%
                      </td>

                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {defect.areaM2} m²
                      </td>

                      <td className="px-3 py-2.5 capitalize font-medium">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            defect.status === "open"
                              ? "bg-rose-50 text-rose-700 font-bold"
                              : defect.status === "scheduled"
                                ? "bg-blue-50 text-blue-700 font-semibold"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {defect.status}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setSelectedDefect(defect)}
                          className="rounded bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        >
                          View Box →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Records & Work Orders (1 col) */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Maintenance Work Orders
                  </h3>
                </div>
                <button
                  onClick={() => setScheduleModalOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {maintenanceTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No active maintenance work orders for this corridor.
                  </div>
                ) : (
                  maintenanceTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-foreground">
                          {task.id}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            task.status === "in_progress"
                              ? "bg-blue-500/20 text-blue-700"
                              : task.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-700"
                                : "bg-amber-500/20 text-amber-700"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="font-medium text-foreground">
                        {task.type}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Chainage: Ch. {task.chainageFrom} → {task.chainageTo} km
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <span>{task.contractor}</span>
                        <span className="font-mono font-semibold text-foreground">
                          ₹{task.estimatedCostLakh} L
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-border/80">
              <Link
                to="/maintenance"
                className="text-xs text-primary font-medium hover:underline block text-center"
              >
                Open Full Maintenance Board →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Defect Detail Drawer Modal */}
      <DefectDetailModal
        defect={selectedDefect}
        road={road}
        onClose={() => setSelectedDefect(null)}
        onStatusChange={handleUpdateDefectStatus}
      />

      {/* Schedule Maintenance Modal */}
      <MaintenanceModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        roads={[road]}
        preselectedRoad={road}
        onSave={handleCreateMaintenance}
      />
    </AppShell>
  );
}
