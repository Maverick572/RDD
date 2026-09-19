import React from "react";
import { rhiBand, RHI_BAND_LABEL, RHI_HEX } from "@/lib/rhi";
import type { Priority, RhiBand } from "@/types";

interface RhiBadgeProps {
  rhi: number;
  showScore?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const RhiBadge: React.FC<RhiBadgeProps> = ({
  rhi,
  showScore = true,
  size = "md",
  className = "",
}) => {
  const band = rhiBand(rhi);
  const color = RHI_HEX[band];

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1 font-medium",
    lg: "text-sm px-3 py-1.5 font-semibold",
  };

  const bgStyles: Record<RhiBand, string> = {
    good: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    fair: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    poor: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    critical: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${bgStyles[band]} ${sizeClasses[size]} ${className}`}
    >
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {showScore ? (
        <span>
          {RHI_BAND_LABEL[band]} <span className="opacity-70 font-mono font-normal">({rhi})</span>
        </span>
      ) : (
        <span>{RHI_BAND_LABEL[band]}</span>
      )}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: Priority; className?: string }> = ({
  priority,
  className = "",
}) => {
  const styles: Record<Priority, string> = {
    low: "bg-slate-100 text-slate-700 border-slate-200",
    medium: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border uppercase tracking-wider ${styles[priority]} ${className}`}
    >
      {priority}
    </span>
  );
};
