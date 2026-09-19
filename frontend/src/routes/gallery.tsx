import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Images,
  LayoutGrid,
  Layers,
  MapPin,
  Maximize2,
  Sparkles,
  Sliders,
  TrendingDown,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAreaFilter } from "@/hooks/useAreaFilter";
import { formatDate, rhiBand, RHI_HEX } from "@/lib/rhi";
import { roadsService } from "@/services/roads.service";
import type { Inspection, Road, RoadImage } from "@/types";

export const Route = createFileRoute("/gallery")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      roadId: (search.roadId as string) || undefined,
      tab: (search.tab as "grid" | "compare" | "inspector") || undefined,
    };
  },
  component: ImageGalleryPage,
});

function ImageGalleryPage() {
  const searchParams = useSearch({ from: "/gallery" });
  const areaFilter = useAreaFilter();

  const [roads, setRoads] = useState<Road[]>([]);
  const [selectedRoadId, setSelectedRoadId] = useState<string>(searchParams.roadId || "");
  const [images, setImages] = useState<RoadImage[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("all");
  const [cameraFilter, setCameraFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"grid" | "compare" | "inspector">(
    searchParams.tab || "grid"
  );

  // Inspector Tab State
  const [activeInspectorImage, setActiveInspectorImage] = useState<RoadImage | null>(null);
  const [showAiBoxes, setShowAiBoxes] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Comparison Tab State
  const [inspectionAId, setInspectionAId] = useState<string>("");
  const [inspectionBId, setInspectionBId] = useState<string>("");
  const [selectedChainageIdx, setSelectedChainageIdx] = useState<number>(0);

  const [loading, setLoading] = useState(true);

  // Load Roads
  useEffect(() => {
    roadsService
      .getRoads({
        stateId: areaFilter.stateId,
        districtId: areaFilter.districtId,
        cityId: areaFilter.cityId,
      })
      .then((res) => {
        setRoads(res);
        if (!selectedRoadId && res.length > 0) {
          setSelectedRoadId(res[0].id);
        }
      });
  }, [areaFilter.stateId, areaFilter.districtId, areaFilter.cityId]);

  // Load Images & Inspections for selected corridor
  useEffect(() => {
    if (!selectedRoadId) return;
    setLoading(true);
    Promise.all([
      roadsService.getRoadImages(selectedRoadId),
      roadsService.getInspections(selectedRoadId),
    ])
      .then(([imgs, insps]) => {
        setImages(imgs);
        setInspections(insps);
        if (imgs.length > 0) {
          setActiveInspectorImage(imgs[0]);
        }
        if (insps.length > 0) {
          setInspectionAId(insps[0].id);
          setInspectionBId(insps[1]?.id || insps[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedRoadId]);

  const selectedRoad = roads.find((r) => r.id === selectedRoadId) || roads[0];

  const filteredImages = images.filter((img) => {
    if (selectedInspectionId !== "all" && img.inspectionId !== selectedInspectionId) {
      return false;
    }
    if (cameraFilter !== "all" && img.cameraId !== cameraFilter) {
      return false;
    }
    return true;
  });

  // Comparison helpers
  const inspA = inspections.find((i) => i.id === inspectionAId) || inspections[0];
  const inspB = inspections.find((i) => i.id === inspectionBId) || inspections[1] || inspections[0];
  const actualAId = inspA?.id || inspectionAId;
  const actualBId = inspB?.id || inspectionBId;

  const imagesA = images.filter((img) => img.inspectionId === actualAId);
  const imagesB = images.filter((img) => img.inspectionId === actualBId);
  const imgA = imagesA[selectedChainageIdx] || imagesA[0];
  const imgB = imagesB[selectedChainageIdx] || imagesB[0];
  const rhiDiff = (inspA?.rhi || 0) - (inspB?.rhi || 0);

  // Inspector helpers
  const currentInspectorIdx = activeInspectorImage
    ? filteredImages.findIndex((i) => i.id === activeInspectorImage.id)
    : 0;
  const hasPrev = currentInspectorIdx > 0;
  const hasNext = currentInspectorIdx < filteredImages.length - 1 && currentInspectorIdx !== -1;

  const handlePrevInspector = () => {
    if (hasPrev) setActiveInspectorImage(filteredImages[currentInspectorIdx - 1]);
  };

  const handleNextInspector = () => {
    if (hasNext) setActiveInspectorImage(filteredImages[currentInspectorIdx + 1]);
  };

  const handleSelectImageForInspector = (img: RoadImage) => {
    setActiveInspectorImage(img);
    setActiveTab("inspector");
  };

  return (
    <AppShell
      areaFilter={areaFilter}
      title="Road Inspection Image & Telemetry Gallery"
      subtitle="Multi-camera surveillance frames with AI distress localization and multi-epoch temporal comparison"
    >
      <div className="space-y-4 p-4 lg:p-6">
        {/* Top Breadcrumbs */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link
              to="/"
              className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
            </Link>
            {selectedRoad && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                <Link
                  to="/roads/$id"
                  params={{ id: selectedRoad.id }}
                  className="font-mono font-medium text-foreground hover:text-primary transition-colors"
                >
                  {selectedRoad.code} ({selectedRoad.name})
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Gallery Corridor Control Bar */}
        <div className="panel p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Corridor selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="label-caps shrink-0">Target Corridor:</span>
            <select
              value={selectedRoadId}
              onChange={(e) => {
                setSelectedRoadId(e.target.value);
                setSelectedInspectionId("all");
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary cursor-pointer w-full md:w-80"
            >
              {roads.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name} (RHI: {r.rhi})
                </option>
              ))}
            </select>
          </div>

          {/* Gallery View Mode Tabs */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1 w-full md:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("grid")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "grid"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Inspection Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "compare"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Epoch Comparison</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("inspector")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "inspector"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Frame Inspector</span>
            </button>
          </div>
        </div>

        {/* Selected Road Status Bar */}
        {selectedRoad && (
          <div className="panel p-3 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-foreground">{selectedRoad.code}</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-medium text-foreground">{selectedRoad.name}</span>
              <span className="text-muted-foreground">({selectedRoad.lengthKm} km • {selectedRoad.lanes} Lanes)</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Health: <strong className="text-foreground">RHI {selectedRoad.rhi}</strong>
              </span>
              <span className="text-muted-foreground">
                Surveillance Runs: <strong className="text-foreground">{inspections.length}</strong>
              </span>
              <span className="text-muted-foreground">
                Total Frames: <strong className="text-foreground">{images.length}</strong>
              </span>
            </div>
          </div>
        )}

        {/* ================= TAB 1: INSPECTION GRID ================= */}
        {activeTab === "grid" && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="panel p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedInspectionId}
                  onChange={(e) => setSelectedInspectionId(e.target.value)}
                  className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer"
                >
                  <option value="all">All Inspection Runs ({inspections.length})</option>
                  {inspections.map((ins, i) => (
                    <option key={ins.id} value={ins.id}>
                      Run #{i + 1} • {formatDate(ins.date)} (RHI: {ins.rhi})
                    </option>
                  ))}
                </select>

                <select
                  value={cameraFilter}
                  onChange={(e) => setCameraFilter(e.target.value)}
                  className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer"
                >
                  <option value="all">All Camera Sensors</option>
                  <option value="CAM-FRONT">CAM-FRONT (Forward High-Res)</option>
                  <option value="CAM-ROAD">CAM-ROAD (Pavement Downward)</option>
                </select>
              </div>

              <span className="text-xs text-muted-foreground font-mono">
                {filteredImages.length} frames
              </span>
            </div>

            {/* Grid */}
            {filteredImages.length === 0 ? (
              <div className="panel p-12 text-center">
                <Images className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  No Inspection Frames Found
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  No imagery matches current filter criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredImages.map((img) => {
                  const band = rhiBand(img.rhiAtCapture);
                  const color = RHI_HEX[band];
                  return (
                    <div
                      key={img.id}
                      onClick={() => handleSelectImageForInspector(img)}
                      className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-xs hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-4/3 overflow-hidden bg-muted">
                        <img
                          src={img.url}
                          alt={img.id}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span
                            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase shadow-sm"
                            style={{ backgroundColor: `${color}ee`, color: "#ffffff" }}
                          >
                            RHI {img.rhiAtCapture}
                          </span>
                          {img.defectsDetected > 0 && (
                            <span className="flex items-center gap-1 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                              <AlertTriangle className="h-3 w-3" />
                              {img.defectsDetected}
                            </span>
                          )}
                        </div>

                        {/* Inspector click hint */}
                        <div className="absolute top-2 right-2 rounded-md bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                          <Eye className="h-3.5 w-3.5" />
                        </div>

                        {/* Bottom Gradient */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-semibold">
                              Ch. {img.chainageKm} km
                            </span>
                            <span className="text-[10px] text-zinc-300 font-mono">
                              {img.cameraId}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="p-2.5 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60">
                        <div className="flex items-center gap-1 truncate">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatDate(img.capturedAt)}</span>
                        </div>
                        <span className="text-[10px] font-mono text-primary font-medium group-hover:underline">
                          Inspect AI Box →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: TEMPORAL EPOCH COMPARISON ================= */}
        {activeTab === "compare" && (
          <div className="panel overflow-hidden space-y-0">
            {/* Header */}
            <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Temporal Multi-Epoch Pavement Comparison
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Side-by-side surface deterioration and post-repair tracking across surveillance passes
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border p-4 bg-background">
              {/* Epoch A */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div>
                  <span className="label-caps block">Inspection Epoch A (Baseline)</span>
                  <select
                    value={actualAId}
                    onChange={(e) => setInspectionAId(e.target.value)}
                    className="mt-1 rounded border border-input bg-card px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer"
                  >
                    {inspections.map((ins, i) => (
                      <option key={ins.id} value={ins.id}>
                        Run {i + 1} • {formatDate(ins.date)} (RHI: {ins.rhi})
                      </option>
                    ))}
                  </select>
                </div>
                {inspA && (
                  <div className="text-right">
                    <div
                      className="font-mono text-lg font-bold"
                      style={{ color: RHI_HEX[rhiBand(inspA.rhi)] }}
                    >
                      RHI {inspA.rhi}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Vehicle: {inspA.vehicle}
                    </div>
                  </div>
                )}
              </div>

              {/* Epoch B */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div>
                  <span className="label-caps block">Inspection Epoch B (Comparison)</span>
                  <select
                    value={actualBId}
                    onChange={(e) => setInspectionBId(e.target.value)}
                    className="mt-1 rounded border border-input bg-card px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer"
                  >
                    {inspections.map((ins, i) => (
                      <option key={ins.id} value={ins.id}>
                        Run {i + 1} • {formatDate(ins.date)} (RHI: {ins.rhi})
                      </option>
                    ))}
                  </select>
                </div>
                {inspB && (
                  <div className="text-right">
                    <div
                      className="font-mono text-lg font-bold"
                      style={{ color: RHI_HEX[rhiBand(inspB.rhi)] }}
                    >
                      RHI {inspB.rhi}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Vehicle: {inspB.vehicle}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chainage Selector */}
            <div className="flex items-center justify-between border-b border-border bg-muted/10 px-6 py-2.5 text-xs">
              <span className="font-medium text-muted-foreground">
                Select Corridor Chainage Point:
              </span>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedChainageIdx(idx)}
                    className={`rounded px-3 py-1 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                      selectedChainageIdx === idx
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    Ch. {(idx * ((selectedRoad?.lengthKm || 2.4) / 4) + 0.4).toFixed(1)} km
                  </button>
                ))}
              </div>
            </div>

            {/* Side-by-Side Images */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-950">
              {/* Frame A */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-black p-4 relative overflow-hidden">
                <div className="absolute top-3 left-3 z-10 rounded bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xs">
                  Epoch A • {formatDate(inspA?.date)}
                </div>
                {imgA ? (
                  <img
                    src={imgA.url}
                    alt="Epoch A"
                    className="max-h-[50vh] rounded-lg object-contain shadow-xl"
                  />
                ) : (
                  <div className="text-zinc-600 text-xs py-20">No frame data</div>
                )}
                {imgA && (
                  <div className="mt-3 text-center text-xs text-zinc-400">
                    Ch. {imgA.chainageKm} km • Sensor: {imgA.cameraId} • {imgA.defectsDetected} defects detected
                  </div>
                )}
              </div>

              {/* Frame B */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-black p-4 relative overflow-hidden">
                <div className="absolute top-3 left-3 z-10 rounded bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xs">
                  Epoch B • {formatDate(inspB?.date)}
                </div>
                {imgB ? (
                  <img
                    src={imgB.url}
                    alt="Epoch B"
                    className="max-h-[50vh] rounded-lg object-contain shadow-xl"
                  />
                ) : (
                  <div className="text-zinc-600 text-xs py-20">No frame data</div>
                )}
                {imgB && (
                  <div className="mt-3 text-center text-xs text-zinc-400">
                    Ch. {imgB.chainageKm} km • Sensor: {imgB.cameraId} • {imgB.defectsDetected} defects detected
                  </div>
                )}
              </div>
            </div>

            {/* Comparison Shift Footer */}
            <div className="p-4 border-t border-border bg-card flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Condition Shift:</span>
                {rhiDiff > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <TrendingUp className="h-4 w-4" /> +{rhiDiff} RHI (Improvement / Post-Maintenance Rectification)
                  </span>
                ) : rhiDiff < 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-rose-600">
                    <TrendingDown className="h-4 w-4" /> {rhiDiff} RHI (Degradation / Defect Growth)
                  </span>
                ) : (
                  <span className="text-muted-foreground font-semibold">Stable (0 Δ RHI)</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: FRAME INSPECTOR ================= */}
        {activeTab === "inspector" && (
          <div className="panel overflow-hidden space-y-0">
            {/* Top Inspector Bar */}
            <div className="p-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {activeInspectorImage?.id || "Frame"}
                  </span>
                  {activeInspectorImage && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${RHI_HEX[rhiBand(activeInspectorImage.rhiAtCapture)]}22`,
                        color: RHI_HEX[rhiBand(activeInspectorImage.rhiAtCapture)],
                      }}
                    >
                      RHI {activeInspectorImage.rhiAtCapture}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground hidden sm:inline">|</span>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  Ch. {activeInspectorImage?.chainageKm} km • Captured {formatDate(activeInspectorImage?.capturedAt)}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* AI Box Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAiBoxes((p) => !p)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer ${
                    showAiBoxes
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Detections</span>
                </button>

                {/* Zoom Controls */}
                <div className="flex items-center rounded-md border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                    className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="px-1.5 text-[11px] font-mono text-muted-foreground">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                    className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Frame Viewer Box */}
            <div className="relative flex min-h-[58vh] items-center justify-center overflow-hidden bg-black p-4 select-none">
              {/* Prev Button */}
              {hasPrev && (
                <button
                  type="button"
                  onClick={handlePrevInspector}
                  className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-zinc-900/80 p-2 text-white shadow-lg backdrop-blur-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Previous Frame"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {/* Image with zoom and bounding boxes */}
              {activeInspectorImage && (
                <div
                  className="relative transition-transform duration-150 ease-out"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={activeInspectorImage.url}
                    alt="Road Frame"
                    className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-2xl"
                  />

                  {showAiBoxes && (
                    <>
                      <div
                        className="absolute border-2 border-rose-500 bg-rose-500/25 rounded"
                        style={{
                          top: "35%",
                          left: "40%",
                          width: "28%",
                          height: "22%",
                        }}
                      >
                        <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase shadow-xs">
                          <span>Pothole</span>
                          <span className="opacity-80">92%</span>
                        </div>
                      </div>

                      <div
                        className="absolute border-2 border-amber-500 bg-amber-500/20 rounded"
                        style={{
                          top: "60%",
                          left: "20%",
                          width: "45%",
                          height: "15%",
                        }}
                      >
                        <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase shadow-xs">
                          <span>Crack / Distress</span>
                          <span className="opacity-80">86%</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Next Button */}
              {hasNext && (
                <button
                  type="button"
                  onClick={handleNextInspector}
                  className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-zinc-900/80 p-2 text-white shadow-lg backdrop-blur-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Next Frame"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Sensor Telemetry Footer */}
            <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  <span>Camera: <strong className="text-foreground">{activeInspectorImage?.cameraId}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Geo-tag: <strong className="text-foreground">[{activeInspectorImage?.location[0].toFixed(4)}, {activeInspectorImage?.location[1].toFixed(4)}]</strong></span>
                </div>
              </div>

              <div>
                Frame <strong className="text-foreground">{currentInspectorIdx + 1}</strong> of {filteredImages.length}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
