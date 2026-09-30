import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Images,
  Loader2,
  MapPin,
  Navigation,
  Shield,
  Eye,
  Camera,
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

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
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
      };
    case "medium":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-700",
        border: "border-amber-500/30",
      };
    default:
      return {
        bg: "bg-sky-500/15",
        text: "text-sky-700",
        border: "border-sky-500/30",
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

function GalleryPage() {
  // Ward data
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardsLoading, setWardsLoading] = useState(true);

  // Active ward
  const [activeWard, setActiveWard] = useState<Ward | null>(null);
  const [wardDefects, setWardDefects] = useState<WardDefect[]>([]);
  const [defectsLoading, setDefectsLoading] = useState(false);

  // Selected photo / road highlight
  const [selectedDefect, setSelectedDefect] = useState<WardDefect | null>(null);
  const [highlightedRoad, setHighlightedRoad] = useState<NearestRoadInfo | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Map center
  const [center, setCenter] = useState({
    latitude: 19.033,
    longitude: 73.0297,
  });

  const galleryRef = useRef<HTMLDivElement | null>(null);

  // ─── Fetch wards on mount ────────────────────────────────────────────────
  useEffect(() => {
    setWardsLoading(true);
    fetch(`${API_BASE}/wards`)
      .then((r) => r.json())
      .then((data) => setWards(data.wards || []))
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
      .then((data) => setWardDefects(data.defects || []))
      .catch(() => setWardDefects([]))
      .finally(() => setDefectsLoading(false));
  }, [activeWard]);

  // Only defects with images
  const defectsWithImages = wardDefects.filter(
    (d) => d.image_url && d.image_url.length > 0
  );

  // ─── Handle clicking on a photo card ─────────────────────────────────────
  const handlePhotoClick = useCallback(async (defect: WardDefect) => {
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

      try {
        const gj = L.geoJSON(ward.geometry as any);
        const c = gj.getBounds().getCenter();
        setFlyTarget({ lat: c.lat, lng: c.lng, zoom: 15 });
      } catch {
        /* ignore */
      }

      setTimeout(() => {
        galleryRef.current?.scrollIntoView({
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

  // ─── Build GeoJSON FeatureCollection ─────────────────────────────────────
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
          e.target.setStyle({
            fillOpacity: 0.5,
            weight: 2.5,
            color: "#0ea5e9",
          });
        },
        mouseout: (e: any) => {
          const isActive = activeWard?.ward_number === wn;
          e.target.setStyle({
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
  const totalPhotos = wards.reduce((s, w) => s + w.defect_count, 0);
  const wardsWithPhotos = wards.filter((w) => w.defect_count > 0).length;

  return (
    <AppShell
      title="Inspection Gallery"
      subtitle="Browse annotated defect photos by ward — click a ward to view images"
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

          <div className="panel p-3.5 border-l-4 border-l-violet-500">
            <span className="label-caps">Total Photos</span>
            <div className="mt-1 text-2xl font-bold font-mono text-violet-600">
              {totalPhotos}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Defect images across wards
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-amber-500">
            <span className="label-caps">Wards with Images</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600">
              {wardsWithPhotos}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Containing defect imagery
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
            {/* Map header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {wardsLoading ? (
                  <span className="flex items-center gap-1 animate-pulse text-primary font-mono">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading wards...
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

                {wardGeoJSON && (
                  <GeoJSON
                    key={`wards-${activeWard?.id ?? "none"}`}
                    data={wardGeoJSON as any}
                    style={wardStyle}
                    onEachFeature={onEachWardFeature}
                  />
                )}

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

        {/* ── Photo Gallery Panel (when a ward is active) ──────────────── */}
        {activeWard && (
          <div ref={galleryRef} className="px-4 lg:px-6 pb-6">
            <div className="panel overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Images className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Photos in Ward {activeWard.ward_number}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                    {defectsWithImages.length} images
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

              {/* Gallery body */}
              {defectsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span className="text-xs text-muted-foreground font-mono">
                    Loading photos...
                  </span>
                </div>
              ) : defectsWithImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 mb-3">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    No Photos Available
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Ward {activeWard.ward_number} has no defect images recorded
                    yet. Run defect detection via Media Upload to generate
                    imagery.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                  {defectsWithImages.map((defect) => {
                    const sev = severityColor(defect.severity);
                    const isSelected = selectedDefect?.id === defect.id;

                    return (
                      <div
                        key={defect.id}
                        onClick={() => handlePhotoClick(defect)}
                        className={`group relative overflow-hidden rounded-xl border bg-card shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col ${isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary"
                          }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-4/3 overflow-hidden bg-muted">
                          <img
                            src={defect.image_url!}
                            alt={`Defect #${defect.id}`}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23334155' width='200' height='150'/%3E%3Ctext fill='%2394a3b8' font-size='12' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                            }}
                          />

                          {/* Top-left badges */}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase shadow-sm ${sev.bg} ${sev.text} border ${sev.border} backdrop-blur-sm`}
                            >
                              {defect.severity}
                            </span>
                          </div>

                          {/* Expand hint on hover */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxUrl(defect.image_url);
                            }}
                            className="absolute top-2 right-2 rounded-md bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer"
                            title="View Full Size"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Bottom gradient */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold">
                                {getDefectDisplayName(defect.type)}
                              </span>
                              <span className="font-mono text-[10px] text-zinc-300">
                                {Math.round(defect.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card footer */}
                        <div className="p-2.5 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60">
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="font-mono text-[10px]">
                              {defect.latitude.toFixed(4)},{" "}
                              {defect.longitude.toFixed(4)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-primary font-medium">
                            #{defect.id}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Road detail strip when a photo is selected */}
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

        {/* ── Lightbox Modal ───────────────────────────────────────────── */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              <img
                src={lightboxUrl}
                alt="Defect full view"
                className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              />
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black text-sm font-bold shadow-lg hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
