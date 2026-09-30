import React from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Maximize2,
  Percent,
  Route,
  Sparkles,
  X,
} from "lucide-react";
import { DEFECT_LABEL, formatDate, SEVERITY_LABEL } from "@/lib/rhi";
import type { Defect, DefectStatus, Road, RoadImage } from "@/types";
import imgPothole from "@/assets/inspection-pothole.jpg";
import imgCracks from "@/assets/inspection-cracks.jpg";
import imgMarkings from "@/assets/inspection-markings.jpg";
import imgGood from "@/assets/inspection-good.jpg";

interface DefectDetailModalProps {
  defect: Defect | null;
  road?: Road;
  onClose: () => void;
  onStatusChange: (id: string, status: DefectStatus) => Promise<void>;
}

export const DefectDetailModal: React.FC<DefectDetailModalProps> = ({
  defect,
  road,
  onClose,
  onStatusChange,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!defect) return null;

  const defectImage =
    defect.type === "pothole"
      ? imgPothole
      : defect.type === "crack"
        ? imgCracks
        : defect.type === "faded_marking"
          ? imgMarkings
          : imgGood;

  const severityColors = {
    low: "text-emerald-700 bg-emerald-50 border-emerald-200",
    medium: "text-amber-700 bg-amber-50 border-amber-200",
    high: "text-rose-700 bg-rose-50 border-rose-200",
  };

  const statusColors = {
    open: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    scheduled: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    repaired: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                {defect.id}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold border uppercase tracking-wider ${
                  severityColors[defect.severity]
                }`}
              >
                {SEVERITY_LABEL[defect.severity]} Severity
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold border capitalize ${
                  statusColors[defect.status]
                }`}
              >
                {defect.status}
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-bold text-foreground">
              {DEFECT_LABEL[defect.type]}
            </h2>
            <p className="text-xs text-muted-foreground">
              Detected on {road?.code || defect.roadId} • {road?.name} at Chainage {defect.chainageKm} km
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Inspection Image with Bounding Box Overlay */}
          <div>
            <div className="label-caps mb-1.5 flex items-center justify-between">
              <span>Inspection Frame Capture</span>
              <span className="flex items-center gap-1 text-[10px] text-primary">
                <Sparkles className="h-3 w-3" /> AI Box Overlay
              </span>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-muted aspect-4/3">
              <img
                src={defectImage}
                alt="Defect capture"
                className="h-full w-full object-cover"
              />
              {/* Mock AI Bounding Box */}
              <div
                className="absolute border-2 border-rose-500 bg-rose-500/20 rounded shadow-xs"
                style={{
                  top: "30%",
                  left: "35%",
                  width: "35%",
                  height: "35%",
                }}
              >
                <div className="absolute -top-5 left-0 bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase rounded shadow-xs">
                  {defect.type} ({Math.round(defect.confidence * 100)}%)
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Geo-tag: [{defect.location[0].toFixed(4)}, {defect.location[1].toFixed(4)}]</span>
              <Link
                to="/gallery"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Gallery <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Details & Metrics */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/50 p-2.5 border border-border/50">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  AI Model Confidence
                </div>
                <div className="mt-0.5 text-base font-bold font-mono text-foreground flex items-center gap-1">
                  <Percent className="h-4 w-4 text-primary" />
                  {Math.round(defect.confidence * 100)}%
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5 border border-border/50">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Estimated Area
                </div>
                <div className="mt-0.5 text-base font-bold font-mono text-foreground">
                  {defect.areaM2} <span className="text-xs font-normal text-muted-foreground">m²</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Detected Date:
                </span>
                <span className="font-medium text-foreground">
                  {formatDate(defect.detectedAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Route className="h-3.5 w-3.5" /> Chainage Location:
                </span>
                <span className="font-mono font-medium text-foreground">
                  Ch. {defect.chainageKm} km
                </span>
              </div>
            </div>

            <div>
              <div className="label-caps mb-1">Distress Assessment Notes</div>
              <p className="rounded-lg border border-border bg-background p-2.5 text-xs text-foreground/90 leading-relaxed">
                {defect.notes}
              </p>
            </div>

            {/* Status Transition Control */}
            <div>
              <div className="label-caps mb-1.5">Workflow Status Action</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["open", "scheduled", "repaired"] as DefectStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => onStatusChange(defect.id, st)}
                      className={`rounded px-2.5 py-1.5 text-xs font-semibold capitalize border transition-all ${
                        defect.status === st
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 border-border"
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Link
            to="/roads/$id"
            params={{ id: defect.roadId }}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View Road Profile ({road?.code || defect.roadId}) →
          </Link>

          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
