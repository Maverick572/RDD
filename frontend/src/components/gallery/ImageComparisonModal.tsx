import React, { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  Camera,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { formatDate, rhiBand, RHI_HEX } from "@/lib/rhi";
import type { Inspection, Road, RoadImage } from "@/types";

interface ImageComparisonModalProps {
  road: Road;
  inspections: Inspection[];
  images: RoadImage[];
  onClose: () => void;
}

export const ImageComparisonModal: React.FC<ImageComparisonModalProps> = ({
  road,
  inspections,
  images,
  onClose,
}) => {
  const [inspectionAId, setInspectionAId] = useState<string>(
    inspections[0]?.id || ""
  );
  const [inspectionBId, setInspectionBId] = useState<string>(
    inspections[1]?.id || inspections[0]?.id || ""
  );
  const [selectedChainageIdx, setSelectedChainageIdx] = useState<number>(0);

  // Sync inspection IDs when inspections prop loads or updates
  useEffect(() => {
    if (inspections.length > 0) {
      if (!inspectionAId || !inspections.some((i) => i.id === inspectionAId)) {
        setInspectionAId(inspections[0].id);
      }
      if (!inspectionBId || !inspections.some((i) => i.id === inspectionBId)) {
        setInspectionBId(inspections[1]?.id || inspections[0].id);
      }
    }
  }, [inspections]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const inspA = inspections.find((i) => i.id === inspectionAId) || inspections[0];
  const inspB = inspections.find((i) => i.id === inspectionBId) || inspections[1] || inspections[0];

  const actualAId = inspA?.id || inspectionAId;
  const actualBId = inspB?.id || inspectionBId;

  const imagesA = images.filter((img) => img.inspectionId === actualAId);
  const imagesB = images.filter((img) => img.inspectionId === actualBId);

  const imgA = imagesA[selectedChainageIdx] || imagesA[0];
  const imgB = imagesB[selectedChainageIdx] || imagesB[0];

  const rhiDiff = (inspA?.rhi || 0) - (inspB?.rhi || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Temporal Inspection Comparison
                <span className="font-mono text-xs font-normal text-muted-foreground hidden sm:inline">
                  ({road.code} - {road.name})
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Compare multi-epoch road surface conditions across surveillance runs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comparison Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border bg-background p-4">
          {/* Inspection A */}
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

          {/* Inspection B */}
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

        {/* Chainage Frame Selector */}
        <div className="flex items-center justify-between border-b border-border bg-muted/10 px-6 py-2 text-xs">
          <span className="font-medium text-muted-foreground">
            Select Chainage Point:
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
                Ch. {(idx * (road.lengthKm / 4) + 0.4).toFixed(1)} km
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Images Area */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden p-6 bg-zinc-950">
          {/* Frame A */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-black p-3 relative overflow-hidden">
            <div className="absolute top-3 left-3 z-10 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-xs">
              Epoch A • {formatDate(inspA?.date)}
            </div>
            {imgA ? (
              <img
                src={imgA.url}
                alt="Epoch A"
                className="max-h-[46vh] rounded object-contain"
              />
            ) : (
              <div className="text-zinc-600 text-xs">No frame data</div>
            )}
            {imgA && (
              <div className="mt-2 text-center text-xs text-zinc-400">
                Ch. {imgA.chainageKm} km • {imgA.cameraId} • {imgA.defectsDetected} defects detected
              </div>
            )}
          </div>

          {/* Frame B */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-black p-3 relative overflow-hidden">
            <div className="absolute top-3 left-3 z-10 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-xs">
              Epoch B • {formatDate(inspB?.date)}
            </div>
            {imgB ? (
              <img
                src={imgB.url}
                alt="Epoch B"
                className="max-h-[46vh] rounded object-contain"
              />
            ) : (
              <div className="text-zinc-600 text-xs">No frame data</div>
            )}
            {imgB && (
              <div className="mt-2 text-center text-xs text-zinc-400">
                Ch. {imgB.chainageKm} km • {imgB.cameraId} • {imgB.defectsDetected} defects detected
              </div>
            )}
          </div>
        </div>

        {/* Footer Delta Status */}
        <div className="flex h-16 items-center justify-between border-t border-border bg-card px-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Condition Shift:</span>
            {rhiDiff > 0 ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-600">
                <TrendingUp className="h-4 w-4" /> +{rhiDiff} RHI (Improvement / Post-Maintenance)
              </span>
            ) : rhiDiff < 0 ? (
              <span className="flex items-center gap-1 font-semibold text-rose-600">
                <TrendingDown className="h-4 w-4" /> {rhiDiff} RHI (Degradation / Defect Growth)
              </span>
            ) : (
              <span className="text-muted-foreground font-semibold">Stable (0 Δ RHI)</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
