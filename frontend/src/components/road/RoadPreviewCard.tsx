import React from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Images,
  Layers,
  MapPin,
  Route,
  Wrench,
  X,
} from "lucide-react";
import { PriorityBadge, RhiBadge } from "./RhiBadge";
import { formatDate, rhiBand, RHI_HEX } from "@/lib/rhi";
import type { Road } from "@/types";

interface RoadPreviewCardProps {
  road: Road | null;
  onClose: () => void;
  onScheduleMaintenance?: (road: Road) => void;
}

export const RoadPreviewCard: React.FC<RoadPreviewCardProps> = ({
  road,
  onClose,
  onScheduleMaintenance,
}) => {
  if (!road) return null;

  const band = rhiBand(road.rhi);
  const color = RHI_HEX[band];

  return (
    <div className="absolute top-3 right-3 z-[1000] w-96 max-w-[calc(100%-24px)] rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-foreground">
              {road.code}
            </span>
            <PriorityBadge priority={road.priority} />
          </div>
          <h3 className="mt-0.5 text-sm font-semibold text-foreground line-clamp-1">
            {road.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{road.category}</span>
            <span>•</span>
            <span>{road.surface}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* RHI Score & Metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-2 text-center border border-border/40">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">
            Health Index
          </div>
          <div
            className="mt-0.5 text-lg font-bold font-mono"
            style={{ color }}
          >
            {road.rhi}
            <span className="text-[11px] font-normal text-muted-foreground">/100</span>
          </div>
          <div className="text-[10px] font-medium capitalize text-muted-foreground">
            {band}
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-2 text-center border border-border/40">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">
            Defects
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono ${
              road.defectCount > 8 ? "text-rose-600" : "text-foreground"
            }`}
          >
            {road.defectCount}
          </div>
          <div className="text-[10px] font-medium text-muted-foreground">
            Identified
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-2 text-center border border-border/40">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">
            Length / Lanes
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono text-foreground">
            {road.lengthKm}
            <span className="text-[11px] font-normal text-muted-foreground">km</span>
          </div>
          <div className="text-[10px] font-medium text-muted-foreground">
            {road.lanes} Lanes
          </div>
        </div>
      </div>

      {/* Inspection & Maintenance summary */}
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between rounded bg-muted/30 px-2.5 py-1.5 border border-border/30">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
            Last Inspection
          </span>
          <span className="font-medium text-foreground">
            {formatDate(road.lastInspection)}
          </span>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 px-2.5 py-1.5 border border-border/30">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground/70" />
            Maintenance
          </span>
          <span className="font-medium text-foreground capitalize">
            {road.maintenance.status.replace("_", " ")} ({road.maintenance.type})
          </span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/roads/$id"
          params={{ id: road.id }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          <span>Full Details</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>

        <Link
          to="/gallery"
          search={{ roadId: road.id }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <Images className="h-3.5 w-3.5 text-primary" />
          <span>Image Gallery</span>
        </Link>
      </div>

      {onScheduleMaintenance && (
        <button
          onClick={() => onScheduleMaintenance(road)}
          className="mt-2 w-full rounded-lg border border-dashed border-border/80 bg-background/50 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          + Schedule Work Order for this corridor
        </button>
      )}
    </div>
  );
};
