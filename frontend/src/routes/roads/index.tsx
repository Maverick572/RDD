import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  ArrowUpRight,
  Eye,
  Layers,
  Loader2,
  Navigation,
  Route as RouteIcon,
  Search,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RhiBadge } from "@/components/road/RhiBadge";
import { rhiBand, RHI_HEX } from "@/lib/rhi";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/roads/")({
  component: RoadsPage,
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

interface WardRoad {
  id: number;
  name: string;
  type: string;
  rhi: number | null;
  geometry: GeoJSON.Geometry | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";

function wardFillColor(defectCount: number): string {
  if (defectCount === 0) return "#22c55e";
  if (defectCount <= 3) return "#facc15";
  if (defectCount <= 8) return "#f97316";
  return "#ef4444";
}

function roadTypeColor(type: string): { bg: string; text: string; border: string } {
  const t = (type || "").toLowerCase();
  if (t.includes("motorway") || t.includes("trunk") || t.includes("national")) {
    return { bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-500/30" };
  }
  if (t.includes("primary") || t.includes("state")) {
    return { bg: "bg-sky-500/15", text: "text-sky-700 dark:text-sky-400", border: "border-sky-500/30" };
  }
  if (t.includes("secondary") || t.includes("arterial")) {
    return { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/30" };
  }
  if (t.includes("tertiary") || t.includes("collector")) {
    return { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/30" };
  }
  return { bg: "bg-slate-500/15", text: "text-slate-700 dark:text-slate-400", border: "border-slate-500/30" };
}

// ─── Map Sub-components ──────────────────────────────────────────────────────

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

/** Imperatively flies the map to a target coordinate */
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

// ─── Main Roads Page ─────────────────────────────────────────────────────────

function RoadsPage() {
  // Ward data from /wards
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardsLoading, setWardsLoading] = useState(true);

  // Currently selected ward & its roads
  const [activeWard, setActiveWard] = useState<Ward | null>(null);
  const [wardRoads, setWardRoads] = useState<WardRoad[]>([]);
  const [roadsLoading, setRoadsLoading] = useState(false);

  // Selected road for highlight & fly
  const [selectedRoad, setSelectedRoad] = useState<WardRoad | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  // Search & Filters for roads table
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedBand, setSelectedBand] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rhi_desc" | "rhi_asc" | "name_asc">("rhi_desc");

  // Map center for coordinates display
  const [center, setCenter] = useState({
    latitude: 19.033,
    longitude: 73.0297,
  });

  // Refs
  const roadsPanelRef = useRef<HTMLDivElement | null>(null);

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

  // ─── Fetch roads when activeWard changes ─────────────────────────────────
  useEffect(() => {
    if (!activeWard) {
      setWardRoads([]);
      return;
    }
    setRoadsLoading(true);
    setSelectedRoad(null);
    fetch(`${API_BASE}/wards/${activeWard.ward_number}/roads`)
      .then((r) => r.json())
      .then((data) => {
        setWardRoads(data.roads || []);
      })
      .catch((err) => {
        console.error("Failed to fetch ward roads:", err);
        setWardRoads([]);
      })
      .finally(() => setRoadsLoading(false));
  }, [activeWard]);

  // ─── Handle clicking on a road row: highlight + zoom map ─────────────────
  const handleRoadClick = useCallback((road: WardRoad) => {
    setSelectedRoad(road);

    if (road.geometry) {
      try {
        const gj = L.geoJSON(road.geometry as any);
        const bounds = gj.getBounds();
        if (bounds.isValid()) {
          const c = bounds.getCenter();
          setFlyTarget({ lat: c.lat, lng: c.lng, zoom: 16 });
        }
      } catch (err) {
        console.warn("Could not calculate road bounds:", err);
      }
    }
  }, []);

  // ─── Handle ward click from map ──────────────────────────────────────────
  const handleWardSelect = useCallback(
    (ward: Ward) => {
      if (activeWard?.id === ward.id) return;
      setActiveWard(ward);
      setSelectedRoad(null);
      setSearch("");
      setSelectedType("all");
      setSelectedBand("all");

      // Fly to ward center
      try {
        const gj = L.geoJSON(ward.geometry as any);
        const c = gj.getBounds().getCenter();
        setFlyTarget({ lat: c.lat, lng: c.lng, zoom: 15 });
      } catch {
        /* ignore */
      }

      // Scroll to roads panel
      setTimeout(() => {
        roadsPanelRef.current?.scrollIntoView({
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
         <div style="font-size:11px;">Click to view road corridors</div>`,
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

  // ─── Filter & Sort roads ─────────────────────────────────────────────────
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    wardRoads.forEach((r) => {
      if (r.type) set.add(r.type);
    });
    return Array.from(set);
  }, [wardRoads]);

  const filteredRoads = useMemo(() => {
    return wardRoads
      .filter((r) => {
        if (search) {
          const q = search.toLowerCase();
          const matches =
            r.name.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            r.id.toString().includes(q);
          if (!matches) return false;
        }
        if (selectedType !== "all" && r.type !== selectedType) {
          return false;
        }
        if (selectedBand !== "all") {
          if (r.rhi === null) {
            if (selectedBand !== "unrated") return false;
          } else {
            if (rhiBand(r.rhi) !== selectedBand) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rhi_desc") return (b.rhi ?? -1) - (a.rhi ?? -1);
        if (sortBy === "rhi_asc") return (a.rhi ?? 999) - (b.rhi ?? 999);
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [wardRoads, search, selectedType, selectedBand, sortBy]);

  // ─── Stats ───────────────────────────────────────────────────────────────
  const ratedRoads = wardRoads.filter((r) => r.rhi !== null);
  const avgRhi =
    ratedRoads.length > 0
      ? Math.round(
          ratedRoads.reduce((sum, r) => sum + (r.rhi || 0), 0) /
            ratedRoads.length
        )
      : null;

  return (
    <AppShell
      title="Road Network"
      subtitle="Explore road network corridors by municipal ward — click a ward to inspect roads"
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

          <div className="panel p-3.5 border-l-4 border-l-emerald-500">
            <span className="label-caps">Ward Corridors</span>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">
              {activeWard ? wardRoads.length : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {activeWard ? `In Ward ${activeWard.ward_number}` : "Select a ward to view"}
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-amber-500">
            <span className="label-caps">Avg Health (RHI)</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600">
              {avgRhi !== null ? `${avgRhi}/100` : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {avgRhi !== null ? `${ratedRoads.length} rated roads` : "Select ward to calculate"}
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-indigo-500">
            <span className="label-caps">Active Ward</span>
            <div className="mt-1 text-2xl font-bold font-mono text-indigo-600">
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

                {/* Highlighted road when a road row is clicked */}
                {selectedRoad?.geometry && (
                  <GeoJSON
                    key={`road-hl-${selectedRoad.id}`}
                    data={selectedRoad.geometry as any}
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
                    <RouteIcon className="h-4 w-4" />
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
                      {wardRoads.length} corridor(s) loaded
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveWard(null);
                    setWardRoads([]);
                    setSelectedRoad(null);
                  }}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Clear Selection ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Roads Panel (shown when a ward is active) ───────────────── */}
        {activeWard && (
          <div ref={roadsPanelRef} className="px-4 lg:px-6 pb-6">
            <div className="panel overflow-hidden">
              {/* Panel header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Road Corridors in Ward {activeWard.ward_number}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                    {filteredRoads.length} corridors
                  </span>
                </div>

                {selectedRoad && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-foreground">
                      {selectedRoad.name}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      #{selectedRoad.id} • {selectedRoad.type}
                    </span>
                    {selectedRoad.rhi !== null && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono font-bold text-primary text-[10px]">
                        RHI {selectedRoad.rhi.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Filter / Search Bar */}
              <div className="p-3 bg-muted/20 border-b border-border flex flex-col md:flex-row items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search road name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Road Type */}
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
                  >
                    <option value="all">All Road Types</option>
                    {uniqueTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  {/* Condition Band */}
                  <select
                    value={selectedBand}
                    onChange={(e) => setSelectedBand(e.target.value)}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
                  >
                    <option value="all">All Conditions</option>
                    <option value="good">Good (≥ 75)</option>
                    <option value="fair">Fair (50–74)</option>
                    <option value="poor">Poor (30–49)</option>
                    <option value="critical">Critical (&lt; 30)</option>
                    <option value="unrated">Unrated</option>
                  </select>

                  {/* Sorting */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
                  >
                    <option value="rhi_desc">Highest Health (RHI Desc)</option>
                    <option value="rhi_asc">Worst Health (RHI Asc)</option>
                    <option value="name_asc">Name (A–Z)</option>
                  </select>
                </div>
              </div>

              {/* Table body */}
              {roadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span className="text-xs text-muted-foreground font-mono">
                    Loading roads from database...
                  </span>
                </div>
              ) : filteredRoads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/10 text-slate-600 mb-3">
                    <Eye className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    No Roads Found
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    {search || selectedType !== "all" || selectedBand !== "all"
                      ? "No roads in this ward match your filter criteria."
                      : `Ward ${activeWard.ward_number} has no intersecting road geometry records.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Corridor / Road Name</th>
                        <th className="px-4 py-3">Type / Class</th>
                        <th className="px-4 py-3">Health Index (RHI)</th>
                        <th className="px-4 py-3">Condition Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredRoads.map((road) => {
                        const isSelected = selectedRoad?.id === road.id;
                        const typeBadge = roadTypeColor(road.type);

                        return (
                          <tr
                            key={road.id}
                            onClick={() => handleRoadClick(road)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-primary/8 border-l-2 border-l-primary"
                                : "hover:bg-muted/40"
                            }`}
                          >
                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                              #{road.id}
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-semibold text-foreground block">
                                {road.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Ward #{activeWard.ward_number} • {activeWard.node || "Navi Mumbai"}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}
                              >
                                {road.type}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              {road.rhi !== null ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="font-mono text-sm font-bold"
                                    style={{ color: RHI_HEX[rhiBand(road.rhi)] }}
                                  >
                                    {road.rhi.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    /100
                                  </span>
                                </div>
                              ) : (
                                <span className="font-mono text-muted-foreground text-[11px] italic">
                                  Unrated
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {road.rhi !== null ? (
                                <RhiBadge rhi={road.rhi} showScore={false} size="sm" />
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRoadClick(road);
                                }}
                                className="rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                              >
                                Highlight →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Road detail strip when a road is selected */}
              {selectedRoad && (
                <div className="border-t border-border px-4 py-3 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {selectedRoad.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Road ID #{selectedRoad.id} • Type: {selectedRoad.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs ml-auto">
                    <div>
                      <span className="text-muted-foreground">Health Rating: </span>
                      {selectedRoad.rhi !== null ? (
                        <span
                          className="font-mono font-bold"
                          style={{ color: RHI_HEX[rhiBand(selectedRoad.rhi)] }}
                        >
                          {selectedRoad.rhi.toFixed(2)}/100 ({rhiBand(selectedRoad.rhi).toUpperCase()})
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground italic">
                          Unrated
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
