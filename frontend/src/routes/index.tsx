import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CheckCircle,
  Clock,
  Compass,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { RoadGisMap } from "@/components/map/RoadGisMap";
import { MaintenanceModal } from "@/components/maintenance/MaintenanceModal";
import { PriorityBadge, RhiBadge } from "@/components/road/RhiBadge";
import { RoadPreviewCard } from "@/components/road/RoadPreviewCard";
import { useAreaFilter } from "@/hooks/useAreaFilter";
import { formatDate, rhiBand, RHI_HEX } from "@/lib/rhi";
import { analyticsService } from "@/services/analytics.service";
import { defectsService } from "@/services/defects.service";
import { maintenanceService } from "@/services/maintenance.service";
import { roadsService } from "@/services/roads.service";
import type { AnalyticsSummary, Defect, MaintenanceTask, Road } from "@/types";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const areaFilter = useAreaFilter();
  const [roads, setRoads] = useState<Road[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [targetRoadForMaintenance, setTargetRoadForMaintenance] = useState<Road | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const filter = {
        stateId: areaFilter.stateId,
        districtId: areaFilter.districtId,
        cityId: areaFilter.cityId,
      };

      const [roadsData, defectsData, analyticsData] = await Promise.all([
        roadsService.getRoads(filter),
        defectsService.getDefects(filter),
        analyticsService.getAnalyticsSummary(filter),
      ]);

      setRoads(roadsData);
      setDefects(defectsData);
      setAnalytics(analyticsData);

      // If selected road is outside current filter, clear selection
      if (selectedRoad && !roadsData.some((r) => r.id === selectedRoad.id)) {
        setSelectedRoad(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [areaFilter.stateId, areaFilter.districtId, areaFilter.cityId]);

  const handleCreateMaintenance = async (task: Omit<MaintenanceTask, "id">) => {
    await maintenanceService.createMaintenanceTask(task);
    await loadData();
  };

  const criticalRoadsList = roads
    .filter((r) => r.rhi < 45 || r.priority === "critical")
    .sort((a, b) => a.rhi - b.rhi)
    .slice(0, 5);

  const avgRhiBand = analytics ? rhiBand(analytics.avgRhi) : "good";
  const avgRhiColor = RHI_HEX[avgRhiBand];

  return (
    <AppShell
      areaFilter={areaFilter}
      title="Infrastructure GIS Command Center"
      subtitle="Real-time multi-tier road health index, AI distress telemetry & predictive work orders"
      actions={
        <button
          onClick={() => {
            setTargetRoadForMaintenance(null);
            setScheduleModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Wrench className="h-3.5 w-3.5" />
          <span>Schedule Work Order</span>
        </button>
      }
    >
      <div className="space-y-5 p-4 lg:p-6">
        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Total Network Length */}
          <div className="panel p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Network Monitored</span>
              <RouteIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {analytics?.totalLengthKm || 0}
              <span className="text-xs font-normal text-muted-foreground ml-1">km</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {roads.length} corridors active
            </div>
          </div>

          {/* Average RHI Score */}
          <div className="panel p-3.5 border-l-4" style={{ borderLeftColor: avgRhiColor }}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Network Avg RHI</span>
              <Activity className="h-4 w-4" style={{ color: avgRhiColor }} />
            </div>
            <div
              className="mt-2 text-2xl font-bold font-mono"
              style={{ color: avgRhiColor }}
            >
              {analytics?.avgRhi || 0}
              <span className="text-xs font-normal text-muted-foreground ml-1">/100</span>
            </div>
            <div className="mt-1 text-[11px] font-medium capitalize" style={{ color: avgRhiColor }}>
              {avgRhiBand} Condition
            </div>
          </div>

          {/* Critical Corridors */}
          <div className="panel p-3.5 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Critical Corridors</span>
              <AlertOctagon className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-rose-600">
              {analytics?.criticalRoads || 0}
            </div>
            <div className="mt-1 text-[11px] text-rose-600 font-medium">
              Urgent action needed
            </div>
          </div>

          {/* Active Defects */}
          <div className="panel p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Open Distress Items</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {analytics?.openDefects || 0}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Potholes, cracks & marks
            </div>
          </div>

          {/* Pending Work Orders */}
          <div className="panel p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Pending Work</span>
              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {analytics?.pendingMaintenance || 0}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Scheduled work orders
            </div>
          </div>

          {/* AI Surveillance Status */}
          <div className="panel p-3.5 bg-primary/5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps text-primary font-semibold">AI Detection Node</span>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-lg font-bold font-mono text-foreground">
              98.4%
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Precision active
            </div>
          </div>
        </div>

        {/* Dominant GIS Map Section */}
        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Interactive GIS Corridor Health Map
              </h2>
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {areaFilter.selectedCity
                  ? areaFilter.selectedCity.name
                  : areaFilter.selectedDistrict
                    ? `${areaFilter.selectedDistrict.name} District`
                    : areaFilter.selectedState
                      ? `${areaFilter.selectedState.name} State`
                      : "India Network Overview"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Click any road polyline to inspect condition, imagery & work status
            </span>
          </div>

          {/* Map Component */}
          <div className="relative">
            <RoadGisMap
              roads={roads}
              defects={defects}
              selectedRoadId={selectedRoad?.id || null}
              onSelectRoad={(r) => setSelectedRoad(r)}
              selectedState={areaFilter.selectedState}
              selectedDistrict={areaFilter.selectedDistrict}
              selectedCity={areaFilter.selectedCity}
              height="h-[560px]"
            />

            {/* Slide-over Road Details Card */}
            {selectedRoad && (
              <RoadPreviewCard
                road={selectedRoad}
                onClose={() => setSelectedRoad(null)}
                onScheduleMaintenance={(r) => {
                  setTargetRoadForMaintenance(r);
                  setScheduleModalOpen(true);
                }}
              />
            )}
          </div>
        </div>

        {/* Lower Analytics & Watchlist Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Critical Roads Watchlist */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Critical Distress Watchlist
                  </h3>
                </div>
                <Link
                  to="/roads"
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  View All ({roads.length}) <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-3 divide-y divide-border/60">
                {criticalRoadsList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No critical distress segments in current filter area.
                  </div>
                ) : (
                  criticalRoadsList.map((road) => (
                    <div
                      key={road.id}
                      onClick={() => setSelectedRoad(road)}
                      className="group flex items-center justify-between py-2.5 px-1.5 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {road.code}
                          </span>
                          <PriorityBadge priority={road.priority} />
                        </div>
                        <p className="mt-0.5 text-xs text-foreground/80 truncate">
                          {road.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {road.lengthKm} km • {road.defectCount} defects • Ch. 0–{road.lengthKm} km
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          className="font-mono text-sm font-bold"
                          style={{ color: RHI_HEX[rhiBand(road.rhi)] }}
                        >
                          RHI {road.rhi}
                        </div>
                        <Link
                          to="/roads/$id"
                          params={{ id: road.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-muted"
                          title="Open Road Profile"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/80 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Automatic prioritization via IRC:35 & RHI indices</span>
              <span className="font-mono">{criticalRoadsList.length} corridors</span>
            </div>
          </div>

          {/* RHI Condition Distribution Chart */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    RHI Condition Breakdown
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {roads.length} Corridors
                </span>
              </div>

              <div className="mt-4 h-48">
                {analytics && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.rhiDistribution}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="band"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(v) => v.toUpperCase()}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [`${value} roads`, "Count"]}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {analytics.rhiDistribution.map((entry) => (
                          <Cell
                            key={`cell-${entry.band}`}
                            fill={RHI_HEX[entry.band]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-border text-center text-[10px]">
              <div>
                <span className="text-emerald-600 font-bold block">
                  {analytics?.rhiDistribution.find((d) => d.band === "good")?.count || 0}
                </span>
                <span className="text-muted-foreground">Good</span>
              </div>
              <div>
                <span className="text-amber-600 font-bold block">
                  {analytics?.rhiDistribution.find((d) => d.band === "fair")?.count || 0}
                </span>
                <span className="text-muted-foreground">Fair</span>
              </div>
              <div>
                <span className="text-orange-600 font-bold block">
                  {analytics?.rhiDistribution.find((d) => d.band === "poor")?.count || 0}
                </span>
                <span className="text-muted-foreground">Poor</span>
              </div>
              <div>
                <span className="text-rose-600 font-bold block">
                  {analytics?.rhiDistribution.find((d) => d.band === "critical")?.count || 0}
                </span>
                <span className="text-muted-foreground">Critical</span>
              </div>
            </div>
          </div>

          {/* Network Health Degradation Trend Chart */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    12-Month Health Progression
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  Aggregated Trend
                </span>
              </div>

              <div className="mt-4 h-48">
                {analytics && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={analytics.rhiTrend}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <YAxis
                        domain={[30, 90]}
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
                        formatter={(value: number) => [`${value} RHI`, "Network Avg"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="rhi"
                        stroke="#0d9488"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#0d9488" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                Monsoon distress drop in Jul–Aug
              </span>
              <Link to="/analytics" className="text-primary hover:underline font-medium">
                Detailed Analytics →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Scheduling Modal */}
      <MaintenanceModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        roads={roads}
        preselectedRoad={targetRoadForMaintenance}
        onSave={handleCreateMaintenance}
      />
    </AppShell>
  );
}
