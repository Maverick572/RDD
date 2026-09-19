import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  Layers,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { useAreaFilter } from "@/hooks/useAreaFilter";
import { DEFECT_LABEL, rhiBand, RHI_HEX, SEVERITY_LABEL } from "@/lib/rhi";
import { analyticsService } from "@/services/analytics.service";
import { roadsService } from "@/services/roads.service";
import type { AnalyticsSummary, Road } from "@/types";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const areaFilter = useAreaFilter();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [roads, setRoads] = useState<Road[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const filter = {
      stateId: areaFilter.stateId,
      districtId: areaFilter.districtId,
      cityId: areaFilter.cityId,
    };
    Promise.all([
      analyticsService.getAnalyticsSummary(filter),
      roadsService.getRoads(filter),
    ])
      .then(([summary, roadsList]) => {
        setAnalytics(summary);
        setRoads(roadsList);
      })
      .finally(() => setLoading(false));
  }, [areaFilter.stateId, areaFilter.districtId, areaFilter.cityId]);

  const severityColors = ["#10b981", "#f59e0b", "#e11d48"];
  const typeColors = ["#e11d48", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

  // State-wise breakdown
  const stateSummary: Record<string, { count: number; sumRhi: number; lengthKm: number }> = {};
  roads.forEach((r) => {
    if (!stateSummary[r.stateId]) {
      stateSummary[r.stateId] = { count: 0, sumRhi: 0, lengthKm: 0 };
    }
    stateSummary[r.stateId].count++;
    stateSummary[r.stateId].sumRhi += r.rhi;
    stateSummary[r.stateId].lengthKm += r.lengthKm;
  });

  const stateChartData = Object.entries(stateSummary).map(([stateId, d]) => ({
    state: stateId,
    avgRhi: Math.round(d.sumRhi / d.count),
    corridors: d.count,
    lengthKm: Math.round(d.lengthKm),
  }));

  return (
    <AppShell
      areaFilter={areaFilter}
      title="Infrastructure Intelligence & Predictive Analytics"
      subtitle="Statistical modeling of pavement health, distress epidemiology & multi-region comparisons"
      actions={
        <button
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify(analytics, null, 2)],
              { type: "application/json" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `roadsense-analytics-report-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-primary" />
          <span>Export GIS Summary JSON</span>
        </button>
      }
    >
      <div className="space-y-5 p-4 lg:p-6">
        {/* Top KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="panel p-4">
            <span className="label-caps">Network Health Average</span>
            <div
              className="mt-1 text-3xl font-bold font-mono"
              style={{
                color: analytics ? RHI_HEX[rhiBand(analytics.avgRhi)] : "#0d9488",
              }}
            >
              {analytics?.avgRhi || 0}
              <span className="text-xs font-normal text-muted-foreground ml-1">/100</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Computed across {analytics?.totalRoads || 0} corridors
            </div>
          </div>

          <div className="panel p-4">
            <span className="label-caps">Active Identified Distress</span>
            <div className="mt-1 text-3xl font-bold font-mono text-foreground">
              {analytics?.openDefects || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Potholes, cracks & line marks
            </div>
          </div>

          <div className="panel p-4">
            <span className="label-caps">Critical Red Flags</span>
            <div className="mt-1 text-3xl font-bold font-mono text-rose-600">
              {analytics?.criticalRoads || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              RHI &lt; 30 high risk segments
            </div>
          </div>

          <div className="panel p-4">
            <span className="label-caps">Network Length Monitored</span>
            <div className="mt-1 text-3xl font-bold font-mono text-foreground">
              {analytics?.totalLengthKm || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">km</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Multi-lane highway & city roads
            </div>
          </div>
        </div>

        {/* Charts Row 1: RHI Distribution & Defect Types */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* RHI Band Breakdown */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Road Health Index (RHI) Distribution
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {roads.length} Corridors
              </span>
            </div>

            <div className="h-64">
              {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.rhiDistribution}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
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
                      formatter={(v: number) => [`${v} corridors`, "Total"]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {analytics.rhiDistribution.map((entry) => (
                        <Cell key={`cell-${entry.band}`} fill={RHI_HEX[entry.band]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Good (≥ 75) • Fair (50–74) • Poor (30–49) • Critical (&lt; 30)
            </p>
          </div>

          {/* Distress Types Breakdown */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Pavement Distress Classification
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                AI Category Breakdown
              </span>
            </div>

            <div className="h-64 flex items-center justify-center">
              {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.defectsByType}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {analytics.defectsByType.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.type}`}
                          fill={typeColors[index % typeColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(v: number, name: string) => [
                        `${v} defects`,
                        DEFECT_LABEL[name as any] || name,
                      ]}
                    />
                    <Legend
                      formatter={(value) => DEFECT_LABEL[value as any] || value}
                      wrapperStyle={{ fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Potholes and alligator cracking constitute the primary structural distress categories.
            </p>
          </div>
        </div>

        {/* Charts Row 2: 12-Month Health Progression & Discovery vs Repair Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Network Health Degradation Progression */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  12-Month Health (RHI) Historical Progression
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Seasonal Degradation
              </span>
            </div>

            <div className="h-64">
              {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.rhiTrend}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="rhiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis domain={[30, 95]} tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(v: number) => [`${v} RHI`, "Network Average"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="rhi"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#rhiGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Monsoon ingress (Jul–Aug) causes notable dip in bituminous durability.
            </p>
          </div>

          {/* Distress Discovery vs Repair Rate */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Distress Discovery vs Resolution Rate
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Work Throughput
              </span>
            </div>

            <div className="h-64">
              {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.defectTrend}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar
                      dataKey="detected"
                      name="AI Detected"
                      fill="#e11d48"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="repaired"
                      name="Repaired"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Post-monsoon surge in road work orders stabilizes backlogs before winter.
            </p>
          </div>
        </div>

        {/* State / Jurisdictional Performance Table */}
        <div className="panel p-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Jurisdictional Health Comparison Across States
              </h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {stateChartData.length} State Jurisdictions
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">State / Jurisdiction</th>
                  <th className="px-4 py-3">Monitored Corridors</th>
                  <th className="px-4 py-3">Total Length (km)</th>
                  <th className="px-4 py-3">Average RHI</th>
                  <th className="px-4 py-3">Jurisdiction Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {stateChartData.map((st) => {
                  const band = rhiBand(st.avgRhi);
                  const color = RHI_HEX[band];
                  return (
                    <tr key={st.state} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">
                        {st.state === "MH"
                          ? "Maharashtra (MH)"
                          : st.state === "KA"
                            ? "Karnataka (KA)"
                            : st.state === "TN"
                              ? "Tamil Nadu (TN)"
                              : st.state === "DL"
                                ? "Delhi (DL)"
                                : "Gujarat (GJ)"}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {st.corridors} corridors
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {st.lengthKm} km
                      </td>
                      <td className="px-4 py-3 font-mono font-bold" style={{ color }}>
                        RHI {st.avgRhi} / 100
                      </td>
                      <td className="px-4 py-3 capitalize font-semibold" style={{ color }}>
                        {band} Condition
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
