import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  Navigation,
  Shield,
  Eye,
  Layers,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/defects")({
  component: DefectsPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ward {
  id: number;
  ward_number: number;
  node: string;
  municipal_corporation: string;
  defect_count: number;
  geometry: GeoJSON.Geometry;
}

interface WardDefect {
  id: number;
  road_id: number;
  type: string;
  confidence: number;
  severity: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  timestamp: string | null;
}

interface NearestRoadInfo {
  id: number;
  name: string;
  type: string;
  rhi: number | null;
  geometry: any;
  distance?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";

function getDefectDisplayName(typeStr: string): string {
  const map: Record<string, string> = {
    D00: "Longitudinal Crack",
    D10: "Transverse Crack",
    D20: "Alligator Crack",
    D40: "Pothole",
    D43: "Crosswalk Blur",
    D44: "Surface Distress",
    pothole: "Pothole",
    crack: "Crack",
    faded_marking: "Faded Marking",
    rutting: "Rutting",
    edge_break: "Edge Break",
  };
  return map[typeStr] || typeStr;
}

function severityColor(sev: string) {
  switch (sev) {
    case "high":
      return {
        bg: "bg-rose-500/15",
        text: "text-rose-700",
        border: "border-rose-500/30",
        dot: "bg-rose-500",
      };
    case "medium":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-700",
        border: "border-amber-500/30",
        dot: "bg-amber-500",
      };
    default:
      return {
        bg: "bg-sky-500/15",
        text: "text-sky-700",
        border: "border-sky-500/30",
        dot: "bg-sky-500",
      };
  }
}

function wardFillColor(defectCount: number): string {
  if (defectCount === 0) return "#22c55e";
  if (defectCount <= 3) return "#facc15";
  if (defectCount <= 8) return "#f97316";
  return "#ef4444";
}

// ─── Map sub-components ──────────────────────────────────────────────────────

/** Tracks center of the map and reports lat/lng to parent */
function CenterTracker({
  onChange,
}: {
  onChange: (loc: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onChange({ latitude: c.lat, longitude: c.lng });
    },
  });
  return null;
}

/** Imperatively flies the map to a target */
function FlyToTarget({
  target,
}: {
  target: { lat: number; lng: number; zoom: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function DefectsPage() {
  // Ward data from /wards
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardsLoading, setWardsLoading] = useState(true);

  // Currently selected / hovered ward
  const [activeWard, setActiveWard] = useState<Ward | null>(null);
  const [wardDefects, setWardDefects] = useState<WardDefect[]>([]);
  const [defectsLoading, setDefectsLoading] = useState(false);

  // When a defect row is clicked: highlighted road + fly target
  const [selectedDefect, setSelectedDefect] = useState<WardDefect | null>(null);
  const [highlightedRoad, setHighlightedRoad] = useState<NearestRoadInfo | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  // Map center for display
  const [center, setCenter] = useState({
    latitude: 19.033,
    longitude: 73.0297,
  });

  // Refs
  const defectsPanelRef = useRef<HTMLDivElement | null>(null);

  // ─── Fetch wards on mount ────────────────────────────────────────────────
  useEffect(() => {
    setWardsLoading(true);
    fetch(`${API_BASE}/wards`)
      .then((r) => r.json())
      .then((data) => {
        setWards(data.wards || []);
      })
      .catch((err) => console.error("Failed to fetch wards:", err))
      .finally(() => setWardsLoading(false));
  }, []);

  // ─── Fetch defects when activeWard changes ───────────────────────────────
  useEffect(() => {
    if (!activeWard) {
      setWardDefects([]);
      return;
    }
    setDefectsLoading(true);
    setSelectedDefect(null);
    setHighlightedRoad(null);
    fetch(`${API_BASE}/wards/${activeWard.ward_number}/defects`)
      .then((r) => r.json())
      .then((data) => {
        setWardDefects(data.defects || []);
      })
      .catch((err) => {
        console.error("Failed to fetch ward defects:", err);
        setWardDefects([]);
      })
      .finally(() => setDefectsLoading(false));
  }, [activeWard]);

  // ─── Handle clicking on a defect row: zoom + highlight road ──────────────
  const handleDefectClick = useCallback(async (defect: WardDefect) => {
    setSelectedDefect(defect);
    setFlyTarget({ lat: defect.latitude, lng: defect.longitude, zoom: 17 });

    try {
      const res = await fetch(
        `${API_BASE}/roads/nearest?lat=${defect.latitude}&lng=${defect.longitude}&threshold=200`
      );
      if (res.ok) {
        const data = await res.json();
        setHighlightedRoad(data.road || null);
      } else {
        setHighlightedRoad(null);
      }
    } catch {
      setHighlightedRoad(null);
    }
  }, []);

  // ─── Handle ward click from the map ──────────────────────────────────────
  const handleWardSelect = useCallback(
    (ward: Ward) => {
      if (activeWard?.id === ward.id) return;
      setActiveWard(ward);
      setHighlightedRoad(null);
      setSelectedDefect(null);

      // Fly to ward center
      try {
        const gj = L.geoJSON(ward.geometry as any);
        const c = gj.getBounds().getCenter();
        setFlyTarget({ lat: c.lat, lng: c.lng, zoom: 15 });
      } catch {
        /* ignore */
      }

      // Scroll to defects panel
      setTimeout(() => {
        defectsPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 200);
    },
    [activeWard]
  );

  // ─── GeoJSON style per ward ──────────────────────────────────────────────
  const wardStyle = useCallback(
    (feature: any) => {
      const wardNumber = feature?.properties?.ward_number;
      const ward = wards.find((w) => w.ward_number === wardNumber);
      const isActive = activeWard?.ward_number === wardNumber;

      return {
        fillColor: ward ? wardFillColor(ward.defect_count) : "#94a3b8",
        fillOpacity: isActive ? 0.55 : 0.3,
        color: isActive ? "#0ea5e9" : "#475569",
        weight: isActive ? 3 : 1.5,
        opacity: 1,
      };
    },
    [wards, activeWard]
  );

  // ─── Build GeoJSON FeatureCollection for wards ───────────────────────────
  const wardGeoJSON = useMemo(() => {
    if (wards.length === 0) return null;
    return {
      type: "FeatureCollection" as const,
      features: wards.map((w) => ({
        type: "Feature" as const,
        properties: {
          ward_number: w.ward_number,
          node: w.node,
          defect_count: w.defect_count,
        },
        geometry: w.geometry,
      })),
    };
  }, [wards]);

  // ─── GeoJSON event handlers ──────────────────────────────────────────────
  const onEachWardFeature = useCallback(
    (feature: any, layer: L.Layer) => {
      const wn = feature.properties?.ward_number;
      const ward = wards.find((w) => w.ward_number === wn);

      // Tooltip on hover
      layer.bindTooltip(
        `<div style="font-size:12px;font-weight:600;">Ward ${wn}</div>
         <div style="font-size:11px;color:#64748b;">${ward?.node || "—"}</div>
         <div style="font-size:11px;">${ward?.defect_count ?? 0} defect(s)</div>`,
        { sticky: true, direction: "top", offset: [0, -10] }
      );

      layer.on({
        click: () => {
          if (ward) handleWardSelect(ward);
        },
        mouseover: (e: any) => {
          const target = e.target;
          target.setStyle({
            fillOpacity: 0.5,
            weight: 2.5,
            color: "#0ea5e9",
          });
        },
        mouseout: (e: any) => {
          const target = e.target;
          const isActive = activeWard?.ward_number === wn;
          target.setStyle({
            fillOpacity: isActive ? 0.55 : 0.3,
            weight: isActive ? 3 : 1.5,
            color: isActive ? "#0ea5e9" : "#475569",
          });
        },
      });
    },
    [wards, activeWard, handleWardSelect]
  );

  // ─── Stats ───────────────────────────────────────────────────────────────
  const totalDefects = wards.reduce((s, w) => s + w.defect_count, 0);
  const wardsWithDefects = wards.filter((w) => w.defect_count > 0).length;

  return (
    <AppShell
      title="Defect Registry"
      subtitle="Explore detected road defects by municipal ward — click a ward to inspect"
    >
      <div className="space-y-0">
        {/* ── KPI Stats Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 lg:p-6 pb-0">
          <div className="panel p-3.5 border-l-4 border-l-sky-500">
            <span className="label-caps">Total Wards</span>
            <div className="mt-1 text-2xl font-bold font-mono text-sky-600">
              {wards.length}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Municipal boundaries loaded
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-rose-500">
            <span className="label-caps">Total Defects</span>
            <div className="mt-1 text-2xl font-bold font-mono text-rose-600">
              {totalDefects}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Detected across all wards
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-amber-500">
            <span className="label-caps">Wards with Defects</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600">
              {wardsWithDefects}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Requiring attention
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-emerald-500">
            <span className="label-caps">Active Ward</span>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">
              {activeWard ? `#${activeWard.ward_number}` : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {activeWard?.node || "Click a ward on the map"}
            </div>
          </div>
        </div>

        {/* ── Full-Width Map ────────────────────────────────────────────── */}
        <div className="p-4 lg:p-6 pt-4">
          <div className="panel overflow-hidden">
            {/* Map header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {wardsLoading ? (
                  <span className="flex items-center gap-1 animate-pulse text-primary font-mono">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading
                    wards...
                  </span>
                ) : (
                  <>
                    <span className="font-mono">
                      LAT: {center.latitude.toFixed(5)}
                    </span>
                    <span className="font-mono">
                      LNG: {center.longitude.toFixed(5)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Leaflet map */}
            <div className="relative h-[300px]">
              <MapContainer
                center={[center.latitude, center.longitude]}
                zoom={12}
                className="h-full w-full z-0"
                scrollWheelZoom
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Ward polygons */}
                {wardGeoJSON && (
                  <GeoJSON
                    key={`wards-${activeWard?.id ?? "none"}`}
                    data={wardGeoJSON as any}
                    style={wardStyle}
                    onEachFeature={onEachWardFeature}
                  />
                )}

                {/* Highlighted road when a defect is clicked */}
                {highlightedRoad?.geometry && (
                  <GeoJSON
                    key={`road-hl-${highlightedRoad.id}`}
                    data={highlightedRoad.geometry}
                    style={{
                      color: "#0284c7",
                      weight: 6,
                      opacity: 0.95,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}

                <CenterTracker onChange={setCenter} />
                <FlyToTarget target={flyTarget} />
              </MapContainer>

              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-card/90 backdrop-blur-sm border border-border p-2.5 text-[10px] space-y-1 shadow-md">
                <div className="font-semibold text-foreground text-[11px] mb-1.5">
                  Defect Density
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />{" "}
                  <span className="text-muted-foreground">0 defects</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#facc15]" />{" "}
                  <span className="text-muted-foreground">1–3 defects</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316]" />{" "}
                  <span className="text-muted-foreground">4–8 defects</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" />{" "}
                  <span className="text-muted-foreground">9+ defects</span>
                </div>
              </div>
            </div>

            {/* Active ward info bar */}
            {activeWard && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      Ward {activeWard.ward_number}{" "}
                      <span className="text-muted-foreground font-normal">
                        — {activeWard.node || "Unknown Node"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {activeWard.municipal_corporation || "—"} •{" "}
                      {activeWard.defect_count} defect(s) total
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveWard(null);
                    setWardDefects([]);
                    setSelectedDefect(null);
                    setHighlightedRoad(null);
                  }}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Clear Selection ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Defects Panel (shown when a ward is active) ───────────────── */}
        {activeWard && (
          <div ref={defectsPanelRef} className="px-4 lg:px-6 pb-6">
            <div className="panel overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Defects in Ward {activeWard.ward_number}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                    {wardDefects.length} items
                  </span>
                </div>

                {selectedDefect && highlightedRoad && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-foreground">
                      {highlightedRoad.name || "Unnamed Road"}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      #{highlightedRoad.id} • {highlightedRoad.type}
                    </span>
                  </div>
                )}
              </div>

              {/* Table body */}
              {defectsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span className="text-xs text-muted-foreground font-mono">
                    Loading defects...
                  </span>
                </div>
              ) : wardDefects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
                    <Eye className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    No Defects Found
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Ward {activeWard.ward_number} has no recorded road defects.
                    The roads appear to be in good condition.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Distress Type</th>
                        <th className="px-4 py-3">Road ID</th>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Confidence</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Detected</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {wardDefects.map((defect) => {
                        const sev = severityColor(defect.severity);
                        const isSelected = selectedDefect?.id === defect.id;

                        return (
                          <tr
                            key={defect.id}
                            onClick={() => handleDefectClick(defect)}
                            className={`transition-colors cursor-pointer ${isSelected
                              ? "bg-primary/8 border-l-2 border-l-primary"
                              : "hover:bg-muted/40"
                              }`}
                          >
                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                              #{defect.id}
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-semibold text-foreground">
                                {getDefectDisplayName(defect.type)}
                              </span>
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                Code: {defect.type}
                              </span>
                            </td>

                            <td className="px-4 py-3 font-mono text-foreground">
                              #{defect.road_id}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${sev.bg} ${sev.text} border ${sev.border}`}
                              >
                                {defect.severity}
                              </span>
                            </td>

                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                              {Math.round(defect.confidence * 100)}%
                            </td>

                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {defect.latitude.toFixed(5)},{" "}
                              {defect.longitude.toFixed(5)}
                            </td>

                            <td className="px-4 py-3 text-muted-foreground">
                              {defect.timestamp
                                ? new Date(defect.timestamp).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )
                                : "—"}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDefectClick(defect);
                                }}
                                className="rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                              >
                                Zoom In →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Road detail strip when a defect is selected */}
              {selectedDefect && highlightedRoad && (
                <div className="border-t border-border px-4 py-3 bg-primary/5 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {highlightedRoad.name || "Unnamed Road"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Road #{highlightedRoad.id} •{" "}
                        {highlightedRoad.distance
                          ? `${highlightedRoad.distance}m from defect`
                          : "Matched"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs ml-auto">
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="font-semibold text-foreground capitalize">
                        {highlightedRoad.type}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">RHI: </span>
                      {highlightedRoad.rhi !== null ? (
                        <span className="font-mono font-bold text-foreground">
                          {highlightedRoad.rhi}/100
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground italic">
                          null
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
