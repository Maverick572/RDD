import React, { useState } from "react";
import { Calendar, DollarSign, HardHat, Layers, Route, Wrench, X } from "lucide-react";
import { PriorityBadge } from "../road/RhiBadge";
import type { MaintenanceStatus, MaintenanceTask, MaintenanceType, Priority, Road } from "@/types";

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roads: Road[];
  preselectedRoad?: Road | null;
  onSave: (task: Omit<MaintenanceTask, "id">) => Promise<void>;
}

const MAINTENANCE_TYPES: MaintenanceType[] = [
  "Pothole patching",
  "Crack sealing",
  "Resurfacing",
  "Lane re-marking",
  "Micro-surfacing",
  "Full reconstruction",
];

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  roads,
  preselectedRoad,
  onSave,
}) => {
  const [roadId, setRoadId] = useState(preselectedRoad?.id || roads[0]?.id || "");
  const [type, setType] = useState<MaintenanceType>("Pothole patching");
  const [priority, setPriority] = useState<Priority>("high");
  const [status, setStatus] = useState<MaintenanceStatus>("scheduled");
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [contractor, setContractor] = useState("National Highway Division / Municipal Cell");
  const [estimatedCostLakh, setEstimatedCostLakh] = useState(15);
  const [chainageFrom, setChainageFrom] = useState(0);
  const [chainageTo, setChainageTo] = useState(2.5);
  const [notes, setNotes] = useState("Preventive AI-flagged distress rectification.");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave({
        roadId,
        type,
        status,
        priority,
        scheduledDate,
        completedDate: status === "completed" ? new Date().toISOString().slice(0, 10) : null,
        contractor,
        estimatedCostLakh: Number(estimatedCostLakh),
        chainageFrom: Number(chainageFrom),
        chainageTo: Number(chainageTo),
        notes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Schedule Work Order
              </h2>
              <p className="text-xs text-muted-foreground">
                Create an AI-prioritized road maintenance intervention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Road Corridor */}
          <div>
            <label className="label-caps block mb-1">Target Road Corridor</label>
            <select
              value={roadId}
              onChange={(e) => setRoadId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
            >
              {roads.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name} (RHI: {r.rhi}, {r.lengthKm} km)
                </option>
              ))}
            </select>
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps block mb-1">Intervention Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MaintenanceType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-caps block mb-1">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Chainage Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps block mb-1">Chainage From (km)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={chainageFrom}
                onChange={(e) => setChainageFrom(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="label-caps block mb-1">Chainage To (km)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={chainageTo}
                onChange={(e) => setChainageTo(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* Scheduled Date & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps block mb-1">Target Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="label-caps block mb-1">Est. Budget (₹ Lakhs)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimatedCostLakh}
                onChange={(e) => setEstimatedCostLakh(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* Contractor */}
          <div>
            <label className="label-caps block mb-1">Contractor / Assigned Cell</label>
            <input
              type="text"
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label-caps block mb-1">Work Description & Scope</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
            >
              <Wrench className="h-4 w-4" />
              <span>{submitting ? "Creating..." : "Issue Work Order"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
