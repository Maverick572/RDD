import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  MapPin,
  Percent,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DefectDetailModal } from "@/components/defects/DefectDetailModal";
import { useAreaFilter } from "@/hooks/useAreaFilter";
import { DEFECT_LABEL, formatDate, SEVERITY_LABEL } from "@/lib/rhi";
import { defectsService } from "@/services/defects.service";
import { roadsService } from "@/services/roads.service";
import type { Defect, DefectStatus, DefectType, Road, Severity } from "@/types";

export const Route = createFileRoute("/defects")({
  component: DefectsPage,
});

function DefectsPage() {
  const areaFilter = useAreaFilter();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roadFilter, setRoadFilter] = useState<string>("all");
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDefects = async () => {
    setLoading(true);
    try {
      const [roadsData, defectsData] = await Promise.all([
        roadsService.getRoads({
          stateId: areaFilter.stateId,
          districtId: areaFilter.districtId,
          cityId: areaFilter.cityId,
        }),
        defectsService.getDefects({
          stateId: areaFilter.stateId,
          districtId: areaFilter.districtId,
          cityId: areaFilter.cityId,
        }),
      ]);
      setRoads(roadsData);
      setDefects(defectsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefects();
  }, [areaFilter.stateId, areaFilter.districtId, areaFilter.cityId]);

  const handleUpdateStatus = async (id: string, status: DefectStatus) => {
    await defectsService.updateDefectStatus(id, status);
    await loadDefects();
    if (selectedDefect && selectedDefect.id === id) {
      setSelectedDefect((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const roadMap = new Map(roads.map((r) => [r.id, r]));

  const filteredDefects = defects.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      const road = roadMap.get(d.roadId);
      const matches =
        d.id.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.notes.toLowerCase().includes(q) ||
        (road && (road.code.toLowerCase().includes(q) || road.name.toLowerCase().includes(q)));
      if (!matches) return false;
    }
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (severityFilter !== "all" && d.severity !== severityFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (roadFilter !== "all" && d.roadId !== roadFilter) return false;
    return true;
  });

  const openCount = defects.filter((d) => d.status === "open").length;
  const highSevCount = defects.filter((d) => d.severity === "high" && d.status !== "repaired").length;
  const scheduledCount = defects.filter((d) => d.status === "scheduled").length;
  const repairedCount = defects.filter((d) => d.status === "repaired").length;

  return (
    <AppShell
      areaFilter={areaFilter}
      title="Pavement Defect & Distress Registry"
      subtitle="AI-detected potholes, alligator cracks, rutting & faded marking log with chainage localization"
    >
      <div className="space-y-4 p-4 lg:p-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="panel p-3.5 border-l-4 border-l-rose-500">
            <span className="label-caps">Open Distress Items</span>
            <div className="mt-1 text-2xl font-bold font-mono text-rose-600">
              {openCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Awaiting work order allocation
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-amber-500">
            <span className="label-caps">High Severity Risks</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600">
              {highSevCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Immediate safety impact
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-blue-500">
            <span className="label-caps">Scheduled Repairs</span>
            <div className="mt-1 text-2xl font-bold font-mono text-blue-600">
              {scheduledCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Work orders assigned
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-emerald-500">
            <span className="label-caps">Rectified Defects</span>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">
              {repairedCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Resolved in current cycle
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="panel p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search defect ID, corridor, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Road filter */}
            <select
              value={roadFilter}
              onChange={(e) => setRoadFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="all">All Corridors ({roads.length})</option>
              {roads.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>

            {/* Defect Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="all">All Distress Types</option>
              <option value="pothole">Potholes</option>
              <option value="crack">Cracks</option>
              <option value="faded_marking">Faded Markings</option>
              <option value="rutting">Rutting</option>
              <option value="edge_break">Edge Breaks</option>
            </select>

            {/* Severity */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="scheduled">Scheduled</option>
              <option value="repaired">Repaired</option>
            </select>

            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {filteredDefects.length} items
            </span>
          </div>
        </div>

        {/* Defects Table */}
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Defect ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Corridor & Chainage</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">AI Confidence</th>
                  <th className="px-4 py-3">Est. Area</th>
                  <th className="px-4 py-3">Detected</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDefects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No defects match your selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDefects.map((defect) => {
                    const road = roadMap.get(defect.roadId);
                    return (
                      <tr
                        key={defect.id}
                        className="hover:bg-muted/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedDefect(defect)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground block">
                            {defect.id}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground">
                            {DEFECT_LABEL[defect.type]}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground">
                            {road?.code || defect.roadId}
                          </span>
                          <span className="text-muted-foreground text-[11px] block">
                            Ch. {defect.chainageKm} km • {road?.name}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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

                        <td className="px-4 py-3">
                          <span className="font-mono text-foreground font-medium">
                            {Math.round(defect.confidence * 100)}%
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {defect.areaM2} m²
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(defect.detectedAt)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${
                              defect.status === "open"
                                ? "bg-rose-500/15 text-rose-700 font-bold"
                                : defect.status === "scheduled"
                                  ? "bg-blue-500/15 text-blue-700 font-semibold"
                                  : "bg-emerald-500/15 text-emerald-700"
                            }`}
                          >
                            {defect.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDefect(defect);
                            }}
                            className="rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                          >
                            Inspect AI Box →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Defect Detail Modal */}
      <DefectDetailModal
        defect={selectedDefect}
        road={selectedDefect ? roadMap.get(selectedDefect.roadId) : undefined}
        onClose={() => setSelectedDefect(null)}
        onStatusChange={handleUpdateStatus}
      />
    </AppShell>
  );
}
