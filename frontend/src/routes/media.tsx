import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  CheckCircle2,
  Cpu,
  Play,
  Sparkles,
  UploadCloud,
  MapPin,
  Compass,
  Activity,
  Loader2,
  Navigation,
  AlertTriangle,
  AlertCircle,
  Eye,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DEFECT_LABEL, formatDate, rhiBand, RHI_HEX, SEVERITY_LABEL } from "@/lib/rhi";
import { roadsService } from "@/services/roads.service";
import type { Road } from "@/types";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/media")({
  component: MediaAnalysisPage,
});

interface NearestRoadInfo {
  id: number;
  name: string;
  type: string;
  rhi: number | null;
  geometry: any;
  distance?: number;
}

interface DetectedDefectItem {
  id: number;
  type: string;
  confidence: number;
  severity: "high" | "medium" | "low" | string;
}

interface DetectionSuccessData {
  filename: string;
  location: {
    latitude: number;
    longitude: number;
  };
  road: {
    id: number;
    name: string;
    type: string;
    rhi: number | null;
    geometry?: any;
  };
  defects: DetectedDefectItem[];
  annotated_image: string;
}

function getDefectDisplayName(typeStr: string): string {
  const map: Record<string, string> = {
    D00: "Longitudinal Crack",
    D10: "Transverse Crack",
    D20: "Alligator Crack",
    D40: "Pothole",
    D43: "Crosswalk Blur",
    D44: "Pothole / Surface Distress",
    pothole: "Pothole",
    crack: "Crack",
    faded_marking: "Faded Marking",
    rutting: "Rutting",
    edge_break: "Edge Break",
  };
  return map[typeStr] || typeStr;
}

function CenterTracker({
  onChange,
}: {
  onChange: (location: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    moveend(e) {
      const center = e.target.getCenter();
      onChange({
        latitude: center.lat,
        longitude: center.lng,
      });
    },
  });

  return null;
}

function MediaAnalysisPage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [location, setLocation] = useState({
    latitude: 19.0330,
    longitude: 73.0297,
  });

  const [nearestRoad, setNearestRoad] = useState<NearestRoadInfo | null>(null);
  const [roadDistance, setRoadDistance] = useState<number | null>(null);
  const [isFetchingRoad, setIsFetchingRoad] = useState<boolean>(false);
  const fetchTimeoutRef = useRef<number | null>(null);

  // Detection API submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [detectionResult, setDetectionResult] = useState<DetectionSuccessData | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const fetchNearestRoad = useCallback(async (lat: number, lng: number) => {
    setIsFetchingRoad(true);
    try {
      const response = await fetch(
        `http://localhost:8000/roads/nearest?lat=${lat}&lng=${lng}&threshold=100`
      );
      if (response.ok) {
        const data = await response.json();
        setNearestRoad(data.road || null);
        setRoadDistance(data.distance ?? (data.road?.distance ?? null));
      } else {
        setNearestRoad(null);
        setRoadDistance(null);
      }
    } catch (err) {
      console.warn("Could not fetch nearest road from backend:", err);
      setNearestRoad(null);
      setRoadDistance(null);
    } finally {
      setIsFetchingRoad(false);
    }
  }, []);

  useEffect(() => {
    roadsService.getRoads().then((r) => {
      setRoads(r);
    });
    // Initial road match on load
    fetchNearestRoad(location.latitude, location.longitude);
  }, [fetchNearestRoad]);

  const handleLocationChange = (newLoc: { latitude: number; longitude: number }) => {
    setLocation(newLoc);
    if (fetchTimeoutRef.current) {
      window.clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = window.setTimeout(() => {
      fetchNearestRoad(newLoc.latitude, newLoc.longitude);
    }, 200);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setDetectionResult(null);
      setDetectionError(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setDetectionResult(null);
      setDetectionError(null);
    }
  };

  // Submit is enabled ONLY when there is an image AND a valid nearest road
  const canSubmit = Boolean(selectedFile && nearestRoad && !isSubmitting);

  const handleSubmitDetect = async () => {
    if (!selectedFile || !nearestRoad || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitProgress(20);
    setDetectionResult(null);
    setDetectionError(null);

    // Progress animation interval
    const interval = setInterval(() => {
      setSubmitProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 300);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const url = `http://localhost:8000/detect?lat=${location.latitude}&lng=${location.longitude}`;
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      setSubmitProgress(100);

      const data = await response.json();

      if (!response.ok || data.error) {
        setDetectionError(data.error || `Server error (${response.status})`);
        setDetectionResult(null);
      } else {
        setDetectionResult(data);
        setDetectionError(null);
      }

      // Scroll to results container smoothly
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      clearInterval(interval);
      setDetectionError(
        err.message || "Failed to reach backend server at http://localhost:8000"
      );
      setDetectionResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Media Processing"
      subtitle="Upload road distress images with GPS coordinates to log defects and inspect neural detections"
    >
      <div className="space-y-6 p-4 lg:p-6">
        {/* Upload & Location Selection Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upload Dropzone */}
          <div className="panel p-5 flex flex-col min-h-[420px] justify-between">
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Upload Road Image
                  </h2>
                </div>
                {selectedFile && (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Image Ready
                  </span>
                )}
              </div>

              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`mt-4 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${dragActive
                  ? "border-primary bg-primary/5"
                  : selectedFile
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-border hover:border-primary/50 bg-background/50"
                  }`}
              >
                <input
                  type="file"
                  id="media-file-input"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 mx-auto">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="font-semibold text-sm text-foreground max-w-[280px] truncate mx-auto">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI detection
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setDetectionResult(null);
                        setDetectionError(null);
                      }}
                      className="text-xs text-rose-600 hover:underline font-medium cursor-pointer"
                    >
                      Choose another file
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="media-file-input"
                    className="cursor-pointer space-y-2"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="font-semibold text-primary hover:underline text-sm">
                        Click to upload road photo
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}or drag & drop here
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Supports JPG, PNG, WEBP
                    </p>
                  </label>
                )}
              </div>
            </div>

            {/* Inference Progress & Trigger Button */}
            <div className="mt-4 pt-3 border-t border-border">
              {isSubmitting ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" />
                      Running Defect Extraction...
                    </span>
                    <span className="font-mono text-primary font-bold">
                      {submitProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${submitProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    disabled={!canSubmit}
                    onClick={handleSubmitDetect}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <Play className="h-4 w-4" />
                    <span>Run Defect Detection & Submit</span>
                  </button>

                  {!canSubmit && (
                    <p className="text-[11px] text-center text-muted-foreground">
                      {!selectedFile && !nearestRoad
                        ? "Please upload an image and position map center over a road"
                        : !selectedFile
                          ? "Please upload a road distress image to enable submit"
                          : "Move map center closer to a valid road (< 100m) to enable submit"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Location & Nearest Road Matcher */}
          <div className="panel p-5 flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Location & Nearest Road Segment
                  </h2>
                </div>
                {isFetchingRoad ? (
                  <span className="flex items-center gap-1 text-[11px] text-primary font-mono animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Matching road...
                  </span>
                ) : nearestRoad ? (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    Road Matched
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                    Outside Threshold
                  </span>
                )}
              </div>

              {/* Map Container */}
              <div className="relative mt-4 h-[240px] overflow-hidden rounded-xl border border-border">
                <MapContainer
                  center={[location.latitude, location.longitude]}
                  zoom={15}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {nearestRoad?.geometry && (
                    <GeoJSON
                      key={`road-${nearestRoad.id}`}
                      data={nearestRoad.geometry}
                      style={{
                        color: "#0284c7",
                        weight: 6,
                        opacity: 0.95,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                    />
                  )}

                  <CenterTracker onChange={handleLocationChange} />
                </MapContainer>

                {/* Fixed center pin marker */}
                <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute h-6 w-6 rounded-full bg-primary/30 animate-ping" />
                    <div className="h-4 w-4 rounded-full border-2 border-white bg-primary shadow-lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* Road Information & Coordinates Panel */}
            <div className="mt-4 space-y-2.5">
              {/* Matched Road Card */}
              {nearestRoad ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Navigation className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {nearestRoad.name || "Unnamed Road Segment"}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: #{nearestRoad.id} • {roadDistance !== null ? `${roadDistance}m away` : "Matched"}
                        </div>
                      </div>
                    </div>
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-primary border border-primary/30 shrink-0">
                      {nearestRoad.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-primary/10 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Type:</span>
                      <span className="font-semibold text-foreground capitalize">
                        {nearestRoad.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-[11px] text-muted-foreground">RHI:</span>
                      {nearestRoad.rhi !== null ? (
                        <span
                          className="font-mono font-bold text-xs"
                          style={{
                            color: RHI_HEX[rhiBand(nearestRoad.rhi)],
                          }}
                        >
                          {nearestRoad.rhi} / 100
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground italic">
                          null
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">
                    {roadDistance !== null
                      ? `Nearest road is ${roadDistance}m away (exceeds 100m threshold).`
                      : "Pan/scroll the map to align center marker near a road."}
                  </p>
                </div>
              )}

              {/* Coordinates strip */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-mono text-[11px]">
                <div>
                  <span className="text-muted-foreground">LAT:</span>{" "}
                  <span className="text-foreground font-semibold">
                    {location.latitude.toFixed(6)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">LNG:</span>{" "}
                  <span className="text-foreground font-semibold">
                    {location.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Results Container (Error OR Success) */}
        {/* ========================================================================= */}
        <div ref={resultsRef}>
          {/* 1. Error Banner Container */}
          {detectionError && (
            <div className="panel p-6 border-rose-500/30 bg-rose-500/5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs font-mono font-bold uppercase text-rose-700">
                      Detection Result
                    </span>
                    <h3 className="text-base font-bold text-foreground">
                      {detectionError === "Defects not found"
                        ? "No Road Defects Found"
                        : detectionError === "Location not found"
                          ? "Road Location Not Matched"
                          : "Inference Error"}
                    </h3>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {detectionError === "Defects not found"
                      ? "The AI model analyzed your uploaded image and found no detectable surface distress (potholes, cracks, rutting) above the confidence threshold. The pavement appears to be in good condition or distress was not clear."
                      : detectionError === "Location not found"
                        ? "The coordinates provided could not be matched to any registered road corridor in the database. Please scroll the map closer to a road segment and try again."
                        : `Backend error: ${detectionError}`}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-500/15 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono text-[11px]">
                  Status: 0 defects inserted to DB
                </span>
                <button
                  onClick={() => setDetectionError(null)}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Dismiss Notice
                </button>
              </div>
            </div>
          )}

          {/* 2. Success Result Container */}
          {detectionResult && (
            <div className="panel p-5 lg:p-6 space-y-5 border-emerald-500/30">
              {/* Header Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complaint Registered
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {detectionResult.defects.length} Defect(s) Identified on {detectionResult.road.name || "Corridor"}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted/40 px-3 py-1.5 border border-border text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Corridor ID
                    </div>
                    <div className="font-mono text-xs font-bold text-foreground">
                      #{detectionResult.road.id} ({detectionResult.road.type})
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/40 px-3 py-1.5 border border-border text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Road RHI
                    </div>
                    <div className="font-mono text-xs font-bold">
                      {detectionResult.road.rhi !== null ? (
                        <span style={{ color: RHI_HEX[rhiBand(detectionResult.road.rhi)] }}>
                          {detectionResult.road.rhi} / 100
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">null</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Column Layout: Annotated Image + Defects Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Annotated Image Frame */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="label-caps flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      Detected Defects
                    </div>
                    {detectionResult.annotated_image && (
                      <a
                        href={detectionResult.annotated_image}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        Open Full Image ↗
                      </a>
                    )}
                  </div>

                  <div className="relative overflow-hidden rounded-xl border border-border bg-black min-h-[260px] aspect-16/9 flex items-center justify-center group shadow-md">
                    <img
                      src={detectionResult.annotated_image}
                      alt="Annotated Defect Result"
                      className="h-full w-full object-contain"
                      loading="eager"
                      onError={() => {
                        console.warn(
                          "Failed loading annotated image URL:",
                          detectionResult.annotated_image,
                        );
                      }}
                    />

                    {/* Defect count overlay */}
                    <div className="absolute bottom-2 left-2 rounded-md bg-black/75 backdrop-blur-xs px-2.5 py-1 text-[11px] font-mono text-white flex items-center gap-1.5 border border-white/10">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{detectionResult.defects.length} Bounding Box Detections</span>
                    </div>
                  </div>

                  {/* Coordinates pill */}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono">
                    <span className="text-muted-foreground">GPS Location:</span>
                    <span className="text-foreground font-semibold">
                      {detectionResult.location.latitude.toFixed(6)}, {detectionResult.location.longitude.toFixed(6)}
                    </span>
                  </div>
                </div>

                {/* Right: Detected Defects List & Database Entries */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-1">
                      <div className="label-caps flex items-center gap-1.5">
                        <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                        Logged Defect Registry Entries
                      </div>
                    </div>

                    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                          <tr>
                            <th className="px-3 py-2.5">Defect ID</th>
                            <th className="px-3 py-2.5">Distress Type</th>
                            <th className="px-3 py-2.5">Severity</th>
                            <th className="px-3 py-2.5 text-right">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {detectionResult.defects.map((defect) => {
                            const isHigh = defect.severity === "high";
                            const isMed = defect.severity === "medium";

                            return (
                              <tr key={defect.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                                  #{defect.id}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="font-semibold text-foreground">
                                    {getDefectDisplayName(defect.type)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    Code: {defect.type}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${isHigh
                                      ? "bg-rose-500/15 text-rose-700 border border-rose-500/30"
                                      : isMed
                                        ? "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                                        : "bg-sky-500/15 text-sky-700 border border-sky-500/30"
                                      }`}
                                  >
                                    {defect.severity}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                                  {Math.round(defect.confidence * 100)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    <Link
                      to="/defects"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      View in Global Defects Registry →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

