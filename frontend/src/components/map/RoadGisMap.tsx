import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  AlertTriangle,
  Compass,
  Eye,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
} from "lucide-react";
import { INDIA, states, districts, cities } from "@/mock-data/admin";
import { stateOutlines, boundsToRing } from "@/mock-data/boundaries";
import { rhiBand, RHI_BAND_LABEL, RHI_HEX } from "@/lib/rhi";
import type { Defect, RhiBand, Road, StateArea, DistrictArea, CityArea } from "@/types";

interface RoadGisMapProps {
  roads: Road[];
  defects?: Defect[];
  selectedRoadId?: string | null;
  onSelectRoad?: (road: Road | null) => void;
  selectedState?: StateArea;
  selectedDistrict?: DistrictArea;
  selectedCity?: CityArea;
  className?: string;
  height?: string;
  showDefectMarkers?: boolean;
  interactive?: boolean;
}

export const RoadGisMap: React.FC<RoadGisMapProps> = ({
  roads,
  defects = [],
  selectedRoadId = null,
  onSelectRoad,
  selectedState,
  selectedDistrict,
  selectedCity,
  className = "",
  height = "h-[620px]",
  showDefectMarkers = true,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const roadsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const defectsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const boundariesLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [mounted, setMounted] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    roads: true,
    defects: true,
    boundaries: true,
  });
  const [bandFilters, setBandFilters] = useState<Record<RhiBand, boolean>>({
    good: true,
    fair: true,
    poor: true,
    critical: true,
  });
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mounted || !mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: INDIA.center,
      zoom: INDIA.zoom,
      zoomControl: false,
      attributionControl: true,
      maxBounds: [
        [4.0, 65.0],
        [38.0, 100.0],
      ],
      minZoom: 4,
    });

    // Zoom control in top-right
    L.control
      .zoom({
        position: "topright",
      })
      .addTo(map);

    // OpenStreetMap Standard Free Public Tile Layer (No API key required)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Create layer groups
    const boundariesGroup = L.layerGroup().addTo(map);
    const roadsGroup = L.layerGroup().addTo(map);
    const defectsGroup = L.layerGroup().addTo(map);

    boundariesLayerGroupRef.current = boundariesGroup;
    roadsLayerGroupRef.current = roadsGroup;
    defectsLayerGroupRef.current = defectsGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [mounted]);

  // Handle Zoom and Center based on Selected Area or Road
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedRoadId) {
      const road = roads.find((r) => r.id === selectedRoadId);
      if (road && road.geometry.coordinates.length > 0) {
        const latLngs = road.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true });
        return;
      }
    }

    if (selectedCity) {
      map.flyToBounds(selectedCity.bounds, { padding: [40, 40], duration: 1.2 });
    } else if (selectedDistrict) {
      map.flyToBounds(selectedDistrict.bounds, { padding: [40, 40], duration: 1.2 });
    } else if (selectedState) {
      map.flyToBounds(selectedState.bounds, { padding: [40, 40], duration: 1.2 });
    } else {
      map.flyTo(INDIA.center, INDIA.zoom, { duration: 1.2 });
    }
  }, [selectedState, selectedDistrict, selectedCity, selectedRoadId, roads]);

  // Render Administrative Boundaries
  useEffect(() => {
    const boundariesGroup = boundariesLayerGroupRef.current;
    if (!boundariesGroup) return;

    boundariesGroup.clearLayers();
    if (!visibleLayers.boundaries) return;

    // Draw state outlines
    Object.entries(stateOutlines).forEach(([stateCode, ring]) => {
      const isCurrentState = selectedState?.code === stateCode;
      const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);

      const poly = L.polygon(latLngs, {
        color: isCurrentState ? "#0d9488" : "#94a3b8",
        weight: isCurrentState ? 2.5 : 1.2,
        dashArray: isCurrentState ? undefined : "4, 4",
        fillColor: isCurrentState ? "#0d9488" : "#cbd5e1",
        fillOpacity: isCurrentState ? 0.08 : 0.03,
      });

      const st = states.find((s) => s.code === stateCode);
      if (st) {
        poly.bindTooltip(
          `<div class="font-medium text-xs">${st.name}</div><div class="text-[10px] text-muted-foreground">State Jurisdiction</div>`,
          { className: "rs-tooltip", sticky: true }
        );
      }
      boundariesGroup.addLayer(poly);
    });

    // Draw District/City boundaries if selected
    if (selectedDistrict) {
      const ring = boundsToRing(selectedDistrict.bounds).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
      const poly = L.polygon(ring, {
        color: "#3b82f6",
        weight: 2,
        dashArray: "3, 3",
        fillColor: "#3b82f6",
        fillOpacity: 0.05,
      });
      poly.bindTooltip(
        `<div class="font-medium text-xs">${selectedDistrict.name} District</div>`,
        { className: "rs-tooltip", sticky: true }
      );
      boundariesGroup.addLayer(poly);
    }

    if (selectedCity) {
      const ring = boundsToRing(selectedCity.bounds).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
      const poly = L.polygon(ring, {
        color: "#8b5cf6",
        weight: 2,
        fillColor: "#8b5cf6",
        fillOpacity: 0.06,
      });
      poly.bindTooltip(
        `<div class="font-medium text-xs">${selectedCity.name}</div><div class="text-[10px] text-muted-foreground">${selectedCity.kind}</div>`,
        { className: "rs-tooltip", sticky: true }
      );
      boundariesGroup.addLayer(poly);
    }
  }, [visibleLayers.boundaries, selectedState, selectedDistrict, selectedCity]);

  // Render Roads Polylines
  useEffect(() => {
    const roadsGroup = roadsLayerGroupRef.current;
    if (!roadsGroup) return;

    roadsGroup.clearLayers();
    if (!visibleLayers.roads) return;

    roads.forEach((road) => {
      const band = rhiBand(road.rhi);
      if (!bandFilters[band]) return;

      const isSelected = road.id === selectedRoadId;
      const color = RHI_HEX[band];
      const latLngs = road.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );

      // If selected, add glowing underlay
      if (isSelected) {
        const glowLine = L.polyline(latLngs, {
          color: "#0f172a",
          weight: 9,
          opacity: 0.85,
          lineCap: "round",
          lineJoin: "round",
        });
        roadsGroup.addLayer(glowLine);
      }

      const polyline = L.polyline(latLngs, {
        color: isSelected ? "#ffffff" : color,
        weight: isSelected ? 5.5 : 4.5,
        opacity: isSelected ? 1 : 0.9,
        lineCap: "round",
        lineJoin: "round",
      });

      // Tooltip HTML
      const tooltipContent = `
        <div class="p-1 min-w-[180px]">
          <div class="flex items-center justify-between gap-2 border-b border-border/60 pb-1 mb-1.5">
            <span class="font-bold text-xs text-foreground">${road.code}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase" style="background-color: ${color}22; color: ${color};">
              RHI ${road.rhi} • ${RHI_BAND_LABEL[band]}
            </span>
          </div>
          <div class="text-xs font-medium text-foreground">${road.name}</div>
          <div class="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>${road.lengthKm} km • ${road.lanes} lanes</span>
            <span class="${road.defectCount > 8 ? "text-rose-600 font-semibold" : ""}">${road.defectCount} defects</span>
          </div>
          <div class="mt-1 text-[10px] text-primary font-medium">Click corridor to inspect →</div>
        </div>
      `;

      polyline.bindTooltip(tooltipContent, {
        className: "rs-tooltip",
        sticky: true,
      });

      if (interactive) {
        polyline.on("mouseover", () => {
          polyline.setStyle({
            weight: isSelected ? 7 : 6.5,
            opacity: 1,
          });
        });

        polyline.on("mouseout", () => {
          polyline.setStyle({
            weight: isSelected ? 5.5 : 4.5,
            opacity: isSelected ? 1 : 0.9,
          });
        });

        polyline.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRoad?.(road);
        });
      }

      roadsGroup.addLayer(polyline);
    });
  }, [roads, selectedRoadId, visibleLayers.roads, bandFilters, interactive, onSelectRoad]);

  // Render Defect Markers
  useEffect(() => {
    const defectsGroup = defectsLayerGroupRef.current;
    if (!defectsGroup) return;

    defectsGroup.clearLayers();
    if (!visibleLayers.defects || !showDefectMarkers) return;

    // If a specific road is selected, only show defects for that road; otherwise show all matching filtered roads
    const relevantRoadIds = new Set(roads.map((r) => r.id));
    const filteredDefects = defects.filter((d) => {
      if (selectedRoadId) return d.roadId === selectedRoadId;
      return relevantRoadIds.has(d.roadId);
    });

    filteredDefects.forEach((defect) => {
      const road = roads.find((r) => r.id === defect.roadId);
      const sevColor =
        defect.severity === "high"
          ? "#e11d48"
          : defect.severity === "medium"
            ? "#f59e0b"
            : "#10b981";

      const iconHtml = `
        <div style="
          width: 14px;
          height: 14px;
          background-color: ${sevColor};
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        "></div>
      `;

      const markerIcon = L.divIcon({
        className: "defect-marker",
        html: iconHtml,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([defect.location[0], defect.location[1]], {
        icon: markerIcon,
      });

      const tooltipContent = `
        <div class="p-1 min-w-[150px]">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-xs font-bold uppercase tracking-wider text-foreground">${defect.type.replace("_", " ")}</span>
            <span class="text-[10px] px-1 py-0.2 rounded uppercase font-semibold" style="background-color: ${sevColor}22; color: ${sevColor};">
              ${defect.severity}
            </span>
          </div>
          <div class="text-[11px] text-muted-foreground">
            ${road?.code || defect.roadId} • Ch. ${defect.chainageKm} km
          </div>
          <div class="text-[10px] text-muted-foreground capitalize">Status: ${defect.status}</div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        className: "rs-tooltip",
        sticky: true,
      });

      defectsGroup.addLayer(marker);
    });
  }, [defects, roads, selectedRoadId, visibleLayers.defects, showDefectMarkers]);

  const resetToIndia = () => {
    onSelectRoad?.(null);
    mapInstanceRef.current?.flyTo(INDIA.center, INDIA.zoom, { duration: 1.2 });
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-card shadow-xs ${height} ${className}`}>
      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Map Controls & Overlays */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        {/* Toggle Panel Button */}
        <button
          onClick={() => setShowControls((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-xs hover:bg-muted transition-colors"
        >
          <Sliders className="h-3.5 w-3.5 text-primary" />
          <span>GIS Layers & Filters</span>
        </button>

        {/* Collapsible GIS Controls Overlay */}
        {showControls && (
          <div className="w-64 rounded-lg border border-border bg-card/95 p-3 text-xs shadow-md backdrop-blur-md space-y-3">
            {/* Layers Toggle */}
            <div>
              <div className="label-caps mb-1.5 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Map Layers
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() =>
                    setVisibleLayers((p) => ({ ...p, roads: !p.roads }))
                  }
                  className={`rounded px-2 py-1 text-center font-medium border transition-colors ${
                    visibleLayers.roads
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted text-muted-foreground border-transparent opacity-60"
                  }`}
                >
                  Roads
                </button>
                <button
                  onClick={() =>
                    setVisibleLayers((p) => ({ ...p, defects: !p.defects }))
                  }
                  className={`rounded px-2 py-1 text-center font-medium border transition-colors ${
                    visibleLayers.defects
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted text-muted-foreground border-transparent opacity-60"
                  }`}
                >
                  Defects
                </button>
                <button
                  onClick={() =>
                    setVisibleLayers((p) => ({
                      ...p,
                      boundaries: !p.boundaries,
                    }))
                  }
                  className={`rounded px-2 py-1 text-center font-medium border transition-colors ${
                    visibleLayers.boundaries
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted text-muted-foreground border-transparent opacity-60"
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            {/* RHI Band Filters */}
            <div>
              <div className="label-caps mb-1.5 flex items-center justify-between">
                <span>RHI Health Scale</span>
                <span className="text-[10px] text-muted-foreground">Toggle</span>
              </div>
              <div className="space-y-1">
                {(["good", "fair", "poor", "critical"] as RhiBand[]).map(
                  (band) => {
                    const active = bandFilters[band];
                    const hex = RHI_HEX[band];
                    return (
                      <button
                        key={band}
                        onClick={() =>
                          setBandFilters((prev) => ({
                            ...prev,
                            [band]: !prev[band],
                          }))
                        }
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors border ${
                          active
                            ? "bg-background border-border/80 text-foreground"
                            : "bg-muted/40 border-transparent text-muted-foreground line-through opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="font-medium capitalize">{band}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {band === "good"
                            ? "≥ 75"
                            : band === "fair"
                              ? "50–74"
                              : band === "poor"
                                ? "30–49"
                                : "< 30"}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-1 border-t border-border flex items-center justify-between">
              <button
                onClick={resetToIndia}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset View
              </button>
              <span className="text-[10px] text-muted-foreground font-mono">
                {roads.length} Roads
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mini Legend in Bottom Right */}
      <div className="absolute bottom-3 right-3 z-[1000] hidden sm:flex items-center gap-3 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-[11px] shadow-sm backdrop-blur-xs">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Good
          <span className="h-2 w-2 rounded-full bg-amber-500 ml-1" /> Fair
          <span className="h-2 w-2 rounded-full bg-orange-500 ml-1" /> Poor
          <span className="h-2 w-2 rounded-full bg-rose-600 ml-1" /> Critical
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-rose-600 border border-white" /> Defect Marker
        </div>
      </div>
    </div>
  );
};
