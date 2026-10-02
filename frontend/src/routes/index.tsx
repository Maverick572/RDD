import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle,
  Eye,
  Info,
  Layers,
  Loader2,
  MapPin,
  Route as RouteIcon,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  ZoomIn,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { LocateMapAtCurrentPosition } from "@/components/map/LocateMapAtCurrentPosition";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip as LeafletTooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

const API_BASE = "http://localhost:8000";
const ZOOM_THRESHOLD = 14;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ward {
  id: number;
  ward_number: number;
  node: string;
  municipal_corporation: string;
  defect_count: number;
  geometry: GeoJSON.Geometry;
}

interface DashboardDefect {
  id: number;
  road_id: number | null;
  type: string;
  type_name: string;
  confidence: number | null;
  severity: "high" | "medium" | "low" | string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  timestamp: string;
  road_name: string;
  road_type: string;
  road_rhi: number | null;
}

interface DashboardRoad {
  id: number;
  name: string;
  type: string;
  rhi: number | null;
  geometry: GeoJSON.Geometry | null;
}

interface DashboardSummary {
  total_wards: number;
  total_roads: number;
  total_defects: number;
  wards_with_defects: number;
  defects_by_severity: { severity: string; count: number }[];
  defects_by_type: { type: string; name: string; count: number }[];
  top_distress_wards: {
    id: number;
    ward_number: number;
    node: string;
    municipal_corporation: string;
    defect_count: number;
  }[];
  recent_defects: DashboardDefect[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wardFillColor(defectCount: number): string {
  if (defectCount === 0) return "#22c55e";
  if (defectCount <= 3) return "#facc15";
  if (defectCount <= 8) return "#f97316";
  return "#ef4444";
}

function severityColor(sev: string) {
  switch (sev) {
    case "high":
      return {
        bg: "bg-rose-500/15",
        text: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/30",
        hex: "#ef4444",
      };
    case "medium":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
        hex: "#f59e0b",
      };
    default:
      return {
        bg: "bg-sky-500/15",
        text: "text-sky-600 dark:text-sky-400",
        border: "border-sky-500/30",
        hex: "#0ea5e9",
      };
  }
}

function roadHighlightStyle(roadType: string) {
  switch (roadType.toLowerCase()) {
    case "primary":
    case "trunk":
      return { color: "#38bdf8", weight: 4.5, opacity: 0.9 };
    case "secondary":
      return { color: "#818cf8", weight: 4, opacity: 0.85 };
    case "tertiary":
      return { color: "#a78bfa", weight: 3.5, opacity: 0.8 };
    case "residential":
      return { color: "#cbd5e1", weight: 2.5, opacity: 0.65 };
    default:
      return { color: "#60a5fa", weight: 3, opacity: 0.75 };
  }
}

// ─── Map Sub-components ──────────────────────────────────────────────────────

function MapViewportObserver({
  onViewportChange,
}: {
  onViewportChange: (vp: {
    zoom: number;
    bounds: L.LatLngBounds;
    center: { lat: number; lng: number };
  }) => void;
}) {
  const map = useMapEvents({
    moveend() {
      onViewportChange({
        zoom: map.getZoom(),
        bounds: map.getBounds(),
        center: { lat: map.getCenter().lat, lng: map.getCenter().lng },
      });
    },
    zoomend() {
      onViewportChange({
        zoom: map.getZoom(),
        bounds: map.getBounds(),
        center: { lat: map.getCenter().lat, lng: map.getCenter().lng },
      });
    },
  });

  useEffect(() => {
    onViewportChange({
      zoom: map.getZoom(),
      bounds: map.getBounds(),
      center: { lat: map.getCenter().lat, lng: map.getCenter().lng },
    });
  }, [map, onViewportChange]);

  return null;
}

// ─── Dashboard Component ─────────────────────────────────────────────────────

function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [allDefects, setAllDefects] = useState<DashboardDefect[]>([]);
  const [roadsInView, setRoadsInView] = useState<DashboardRoad[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingRoads, setLoadingRoads] = useState(false);

  const [currentZoom, setCurrentZoom] = useState(12);
  const [center, setCenter] = useState({ latitude: 19.033, longitude: 73.0297 });

  const isZoomedIn = currentZoom >= ZOOM_THRESHOLD;

  // ─── 1. Load Dashboard Summary ─────────────────────────────────────────────
  useEffect(() => {
    setLoadingSummary(true);
    fetch(`${API_BASE}/dashboard/summary`)
      .then((res) => res.json())
      .then((data: DashboardSummary) => {
        setSummary(data);
      })
      .catch((err) => console.error("Failed to load dashboard summary:", err))
      .finally(() => setLoadingSummary(false));
  }, []);

  // ─── 2. Load Wards GeoJSON ─────────────────────────────────────────────────
  useEffect(() => {
    setLoadingWards(true);
    fetch(`${API_BASE}/wards`)
      .then((res) => res.json())
      .then((data) => {
        setWards(data.wards || []);
      })
      .catch((err) => console.error("Failed to load wards:", err))
      .finally(() => setLoadingWards(false));
  }, []);

  // ─── 3. Load All Defects for Map ───────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/dashboard/defects`)
      .then((res) => res.json())
      .then((data) => {
        setAllDefects(data.defects || []);
      })
      .catch((err) => console.error("Failed to load dashboard defects:", err));
  }, []);

  // ─── 4. Viewport Observer Callback ─────────────────────────────────────────
  const fetchBboxTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleViewportChange = useCallback(
    (vp: {
      zoom: number;
      bounds: L.LatLngBounds;
      center: { lat: number; lng: number };
    }) => {
      setCurrentZoom(vp.zoom);
      setCenter({ latitude: vp.center.lat, longitude: vp.center.lng });

      if (vp.zoom >= ZOOM_THRESHOLD) {
        if (fetchBboxTimeoutRef.current) {
          clearTimeout(fetchBboxTimeoutRef.current);
        }

        fetchBboxTimeoutRef.current = setTimeout(() => {
          setLoadingRoads(true);
          const sw = vp.bounds.getSouthWest();
          const ne = vp.bounds.getNorthEast();

          fetch(
            `${API_BASE}/dashboard/roads?min_lat=${sw.lat}&min_lng=${sw.lng}&max_lat=${ne.lat}&max_lng=${ne.lng}&limit=400`
          )
            .then((res) => res.json())
            .then((data) => {
              setRoadsInView(data.roads || []);
            })
            .catch((err) => console.error("Failed to load viewport roads:", err))
            .finally(() => setLoadingRoads(false));
        }, 300);
      } else {
        setRoadsInView([]);
      }
    },
    []
  );

  // GeoJSON for wards
  const wardGeoJSON = useMemo(() => {
    if (!wards.length) return null;
    return {
      type: "FeatureCollection" as const,
      features: wards
        .filter((w) => w.geometry)
        .map((w) => ({
          type: "Feature" as const,
          id: w.id,
          properties: {
            ward_number: w.ward_number,
            node: w.node,
            municipal_corporation: w.municipal_corporation,
            defect_count: w.defect_count,
          },
          geometry: w.geometry,
        })),
    };
  }, [wards]);

  // Ward polygon styling
  const wardStyle = useCallback(
    (feature: any) => {
      const defectCount = feature?.properties?.defect_count ?? 0;
      return {
        fillColor: wardFillColor(defectCount),
        fillOpacity: isZoomedIn ? 0.08 : 0.45,
        color: "#ffffff",
        weight: isZoomedIn ? 1 : 1.5,
        opacity: 0.7,
      };
    },
    [isZoomedIn]
  );

  const highSeverityCount =
    summary?.defects_by_severity.find((s) => s.severity === "high")?.count || 0;
  const mediumSeverityCount =
    summary?.defects_by_severity.find((s) => s.severity === "medium")?.count || 0;
  const lowSeverityCount =
    summary?.defects_by_severity.find((s) => s.severity === "low")?.count || 0;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Real-time road distress telemetry, defect mapping & ward analytics"
    >
      <div className="space-y-5 p-4 lg:p-6">
        {/* ── Top KPI Cards Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Wards */}
          <div className="panel p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Monitored Wards</span>
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {loadingSummary ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                summary?.total_wards || 111
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Navi Mumbai Municipal jurisdiction
            </div>
          </div>

          {/* Total Defects */}
          <div className="panel p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Total Distress Items</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {loadingSummary ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                summary?.total_defects || 0
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Cracks, potholes & surface distress
            </div>
          </div>

          {/* High Severity Distress */}
          <div className="panel p-4 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">High Severity Distress</span>
              <AlertOctagon className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {loadingSummary ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                highSeverityCount
              )}
            </div>
            <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              Immediate inspection recommended
            </div>
          </div>

          {/* Distress Affected Wards */}
          <div className="panel p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="label-caps">Distress-Affected Wards</span>
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {loadingSummary ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                summary?.wards_with_defects || 0
              )}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                / {summary?.total_wards || 111}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Wards with active defects identified
            </div>
          </div>
        </div>

        {/* ── Dominant GIS Map Section ──────────────────────────────────────── */}
        <div className="panel overflow-hidden">
          {/* Map Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
              {loadingWards ? (
                <span className="flex items-center gap-1 animate-pulse text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading wards...
                </span>
              ) : loadingRoads && isZoomedIn ? (
                <span className="flex items-center gap-1 animate-pulse text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading road corridors...
                </span>
              ) : (
                <>
                  <span>LAT: {center.latitude.toFixed(5)}</span>
                  <span>LNG: {center.longitude.toFixed(5)}</span>
                </>
              )}
            </div>
          </div>

          {/* Leaflet Map */}
          <div className="relative h-[480px] lg:h-[560px]">
            <MapContainer
              center={[center.latitude, center.longitude]}
              zoom={12}
              className="h-full w-full z-0"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocateMapAtCurrentPosition zoom={12} />

              {/* 1. Ward Polygons (No hover details per request) */}
              {wardGeoJSON && (
                <GeoJSON
                  key={`dashboard-wards-${isZoomedIn ? "detailed" : "overview"}`}
                  data={wardGeoJSON as any}
                  style={wardStyle}
                />
              )}

              {/* 2. Highlighted Road Corridors (Only when Zoomed In - Displays RHI & road details) */}
              {isZoomedIn &&
                roadsInView.map((road) => {
                  if (!road.geometry) return null;
                  const style = roadHighlightStyle(road.type);

                  return (
                    <GeoJSON
                      key={`road-${road.id}`}
                      data={road.geometry as any}
                      style={{
                        color: style.color,
                        weight: style.weight,
                        opacity: style.opacity,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                      onEachFeature={(_, layer) => {
                        layer.bindTooltip(
                          `<div style="font-family: inherit; font-size: 11px; padding: 4px 6px;">
                            <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${road.name}</div>
                            <div style="color: #64748b; font-size: 10px; text-transform: capitalize;">Class: ${road.type}</div>
                            <div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 11px; color: ${road.rhi !== null ? (road.rhi >= 75 ? "#16a34a" : road.rhi >= 50 ? "#d97706" : "#dc2626") : "#0284c7"};">
                              <span>Road Health Index (RHI):</span>
                              <span style="font-family: monospace;">${road.rhi !== null ? `${road.rhi}/100` : "Unrated"}</span>
                            </div>
                          </div>`,
                          { sticky: true, className: "rs-tooltip" }
                        );
                      }}
                    />
                  );
                })}

              {/* 3. Defect Dots (Only when Zoomed In - Displays Severity & defect details) */}
              {isZoomedIn &&
                allDefects.map((defect) => {
                  const sevInfo = severityColor(defect.severity);

                  return (
                    <CircleMarker
                      key={`defect-dot-${defect.id}`}
                      center={[defect.latitude, defect.longitude]}
                      radius={6}
                      pathOptions={{
                        color: "#ffffff",
                        weight: 2,
                        fillColor: sevInfo.hex,
                        fillOpacity: 0.95,
                      }}
                    >
                      <LeafletTooltip sticky className="rs-tooltip">
                        <div className="p-1.5 min-w-[170px] text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1">
                            <span className="font-bold text-foreground">
                              {defect.type_name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${sevInfo.bg} ${sevInfo.text}`}
                            >
                              {defect.severity} Severity
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Road: <span className="text-foreground font-medium">{defect.road_name}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Severity Level:</span>
                            <span className="font-semibold uppercase" style={{ color: sevInfo.hex }}>
                              {defect.severity}
                            </span>
                          </div>
                          {defect.confidence !== null && (
                            <div className="text-[10px] text-muted-foreground">
                              AI Confidence: <span className="font-mono font-semibold">{(defect.confidence * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </LeafletTooltip>
                    </CircleMarker>
                  );
                })}

              <MapViewportObserver onViewportChange={handleViewportChange} />
            </MapContainer>

            {/* Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-card/90 backdrop-blur-sm border border-border p-2.5 text-[10px] space-y-1.5 shadow-md">
              <div className="font-semibold text-foreground text-[11px] mb-1">
                Defect Density
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />
                  <span className="text-muted-foreground">0 defects</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#facc15]" />
                  <span className="text-muted-foreground">1–3 defects</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316]" />
                  <span className="text-muted-foreground">4–8 defects</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" />
                  <span className="text-muted-foreground">9+ defects</span>
                </div>
              </div>

              {isZoomedIn && (
                <div className="pt-1.5 border-t border-border space-y-1">
                  <div className="text-[10px] font-semibold text-foreground">Defect Dots</div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 ring-1 ring-white" />
                    <span className="text-muted-foreground">High Severity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 ring-1 ring-white" />
                    <span className="text-muted-foreground">Medium / Low</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Lower Analytics & Real Insights Section ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Defect Type Breakdown */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Distress by Defect Category
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {summary?.total_defects || 0} Total
                </span>
              </div>

              <div className="mt-4 h-48">
                {summary && summary.defects_by_type.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.defects_by_type}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={35}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [`${value} detections`, "Count"]}
                      />
                      <Bar dataKey="count" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No defect data recorded yet
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Automated YOLOv8 Distress Classification</span>
              <Link to="/defects" className="text-primary hover:underline font-medium">
                View Defect Register →
              </Link>
            </div>
          </div>

          {/* 2. Top Distress Hotspot Wards */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Top Distress Hotspots
                  </h3>
                </div>
                <Link
                  to="/defects"
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  Inspect Wards <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-3 divide-y divide-border/60">
                {summary && summary.top_distress_wards.length > 0 ? (
                  summary.top_distress_wards.map((ward) => (
                    <div
                      key={ward.id}
                      className="flex items-center justify-between py-2.5 px-1.5 hover:bg-muted/40 rounded-lg transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-xs text-foreground">
                          Ward #{ward.ward_number} • {ward.node}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {ward.municipal_corporation}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold font-mono"
                          style={{
                            backgroundColor: `${wardFillColor(ward.defect_count)}20`,
                            color: wardFillColor(ward.defect_count),
                          }}
                        >
                          {ward.defect_count} {ward.defect_count === 1 ? "defect" : "defects"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No distress hotspots detected across monitored wards.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Cross-correlated with PostGIS GIS boundaries</span>
              <span className="font-mono">{summary?.top_distress_wards.length || 0} wards</span>
            </div>
          </div>

          {/* 3. Recent Real Detections Telemetry */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Recent AI Detections Feed
                  </h3>
                </div>
                <Link
                  to="/gallery"
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  Gallery <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-3 divide-y divide-border/60">
                {summary && summary.recent_defects.length > 0 ? (
                  summary.recent_defects.slice(0, 4).map((defect) => {
                    const sev = severityColor(defect.severity);

                    return (
                      <div
                        key={defect.id}
                        className="flex items-center gap-3 py-2 px-1 hover:bg-muted/40 rounded-lg transition-colors"
                      >
                        {defect.image_url ? (
                          <img
                            src={defect.image_url}
                            alt={defect.type_name}
                            className="h-10 w-10 rounded-md object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                            AI
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {defect.type_name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${sev.bg} ${sev.text}`}
                            >
                              {defect.severity}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {defect.road_name}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">
                            {new Date(defect.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} • {defect.confidence ? `${(defect.confidence * 100).toFixed(0)}% conf` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No detections uploaded yet. Upload images via Media Detection tab.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Telemetry directly from database</span>
              <Link to="/media" className="text-primary hover:underline font-medium">
                Upload & Detect →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
