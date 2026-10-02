import { createFileRoute } from "@tanstack/react-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Loader2,
  Plus,
  Route as RouteIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RhiBadge } from "@/components/road/RhiBadge";

export const Route = createFileRoute("/maintenance")({
  component: MaintenancePage,
});

const API_BASE = "http://localhost:8000";
const MAINTENANCE_TYPES = [
  "Pothole patching",
  "Crack sealing",
  "Resurfacing",
  "Lane re-marking",
  "Micro-surfacing",
  "Full reconstruction",
];

interface Ward {
  id: number;
  ward_number: number;
  node: string | null;
  municipal_corporation: string | null;
}

interface WardRoad {
  id: number;
  name: string;
  type: string;
  rhi: number | null;
  defect_count: number;
  geometry: GeoJSON.Geometry | null;
}

interface MaintenanceRecord {
  id: number;
  road_id: number;
  scheduled_date: string;
  progress: number;
  status: string;
  maintenance_type: string;
  road_name: string;
  road_type: string;
  rhi: number | null;
  defect_count: number;
}

interface MaintenanceHistoryRecord {
  id: number;
  road_id: number;
  start_date: string;
  completed_date: string;
  maintenance_type: string;
  road_name: string;
  road_type: string;
}

type MaintenanceTab = "schedule" | "manage" | "history";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function MaintenancePage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWardNumber, setSelectedWardNumber] = useState("");
  const [activeTab, setActiveTab] = useState<MaintenanceTab>("schedule");
  const [roads, setRoads] = useState<WardRoad[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [history, setHistory] = useState<MaintenanceHistoryRecord[]>([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleRoad, setScheduleRoad] = useState<WardRoad | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [progressValues, setProgressValues] = useState<Record<number, string>>({});
  const [scheduledDate, setScheduledDate] = useState("");
  const [maintenanceType, setMaintenanceType] = useState(MAINTENANCE_TYPES[0]);

  const selectedWard = useMemo(
    () => wards.find((ward) => String(ward.ward_number) === selectedWardNumber),
    [wards, selectedWardNumber]
  );

  const loadWardData = useCallback(async (wardNumber: string) => {
    if (!wardNumber) {
      setRoads([]);
      setMaintenance([]);
      setHistory([]);
      return;
    }

    setLoadingContent(true);
    setError(null);
    try {
      const [roadsResponse, maintenanceResponse, historyResponse] = await Promise.all([
        fetch(`${API_BASE}/wards/${wardNumber}/roads`),
        fetch(`${API_BASE}/wards/${wardNumber}/maintenance`),
        fetch(`${API_BASE}/wards/${wardNumber}/maintenance/history`),
      ]);

      for (const response of [roadsResponse, maintenanceResponse, historyResponse]) {
        if (!response.ok) {
          throw new Error(`Failed to load ward maintenance data (${response.status})`);
        }
      }

      const [roadsData, maintenanceData, historyData] = await Promise.all([
        roadsResponse.json(),
        maintenanceResponse.json(),
        historyResponse.json(),
      ]);
      setRoads(roadsData.roads || []);
      setMaintenance(maintenanceData.maintenance || []);
      setHistory(historyData.maintenance_history || []);
    } catch (loadError) {
      console.error("Failed to load ward maintenance data:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load ward maintenance data"
      );
      setRoads([]);
      setMaintenance([]);
      setHistory([]);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/wards`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load wards (${response.status})`);
        return response.json();
      })
      .then((data) => setWards(data.wards || []))
      .catch((loadError) => {
        console.error("Failed to load wards:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load wards");
      })
      .finally(() => setLoadingWards(false));
  }, []);

  useEffect(() => {
    void loadWardData(selectedWardNumber);
  }, [selectedWardNumber, loadWardData]);

  const eligibleRoads = useMemo(
    () => {
      const scheduledRoadIds = new Set(maintenance.map((record) => record.road_id));
      return roads
        .filter(
          (road) =>
            road.rhi !== null &&
            road.rhi < 100 &&
            !scheduledRoadIds.has(road.id)
        )
        .sort((a, b) => (a.rhi ?? 101) - (b.rhi ?? 101));
    },
    [roads, maintenance]
  );

  const refreshWardData = async () => loadWardData(selectedWardNumber);

  const handleSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleRoad || !scheduledDate || !maintenanceType) return;

    setSaving(true);
    setScheduleError(null);
    try {
      const response = await fetch(`${API_BASE}/maintenance/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          road_id: scheduleRoad.id,
          scheduled_date: new Date(scheduledDate).toISOString(),
          maintenance_type: maintenanceType,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Failed to schedule repair (${response.status})`);
      }

      setScheduleRoad(null);
      setScheduledDate("");
      await refreshWardData();
    } catch (scheduleRequestError) {
      console.error("Failed to schedule maintenance:", scheduleRequestError);
      setScheduleError(
        scheduleRequestError instanceof Error
          ? scheduleRequestError.message
          : "Failed to schedule repair"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProgress = async (record: MaintenanceRecord) => {
    const progress = Number(progressValues[record.id] ?? record.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      setError("Progress must be between 0 and 100.");
      return;
    }

    setUpdatingId(record.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/maintenance/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: progress > 0 ? "in_progress" : record.status,
          progress,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Failed to update progress (${response.status})`);
      }
      setProgressValues((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await refreshWardData();
    } catch (updateError) {
      console.error("Failed to update maintenance progress:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update repair progress"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteRepair = async (record: MaintenanceRecord) => {
    setUpdatingId(record.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/maintenance/${record.id}/complete`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Failed to complete repair (${response.status})`);
      }
      await refreshWardData();
    } catch (completeError) {
      console.error("Failed to complete maintenance:", completeError);
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Failed to complete repair"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const tabs: { id: MaintenanceTab; label: string }[] = [
    { id: "schedule", label: "Schedule Repairs" },
    { id: "manage", label: "Manage Repairs" },
    { id: "history", label: "View History" },
  ];

  return (
    <AppShell
      title="Maintenance"
      subtitle="Prioritize, schedule, and track road repairs by ward"
    >
      <div className="space-y-5 p-4 lg:p-6">
        <section className="panel p-4">
          <label htmlFor="maintenance-ward" className="label-caps mb-2 block">
            Select Ward
          </label>
          <select
            id="maintenance-ward"
            value={selectedWardNumber}
            onChange={(event) => {
              setSelectedWardNumber(event.target.value);
              setActiveTab("schedule");
              setError(null);
            }}
            disabled={loadingWards}
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">
              {loadingWards ? "Loading wards..." : "Choose a ward to view repairs"}
            </option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.ward_number}>
                Ward {ward.ward_number} — {ward.node || "Unknown Node"}
              </option>
            ))}
          </select>
          {!selectedWardNumber && error && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {error}
            </p>
          )}
        </section>

        {selectedWardNumber && (
          <>
            <nav className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Maintenance sections">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <RouteIcon className="h-4 w-4 text-primary" />
              Ward {selectedWard?.ward_number} — {selectedWard?.node || "Unknown Node"}
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {loadingContent ? (
              <div className="panel flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading ward maintenance records...
              </div>
            ) : (
              <>
                {activeTab === "schedule" && (
                  <section className="panel overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">Roads Requiring Repair</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Roads with RHI below 100, ordered from lowest health score.
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-muted-foreground">
                        {eligibleRoads.length} roads
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Corridor / Road Name</th>
                            <th className="px-4 py-3">Type / Class</th>
                            <th className="px-4 py-3">Health Index (RHI)</th>
                            <th className="px-4 py-3">Defect Count</th>
                            <th className="px-4 py-3">Condition Status</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {eligibleRoads.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                                No roads with RHI below 100 were found in this ward.
                              </td>
                            </tr>
                          ) : (
                            eligibleRoads.map((road) => (
                              <tr key={road.id} className="hover:bg-muted/30">
                                <td className="px-4 py-3 font-mono font-bold">#{road.id}</td>
                                <td className="px-4 py-3">
                                  <span className="block font-semibold text-foreground">{road.name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Ward #{selectedWard?.ward_number} • {selectedWard?.node || "Navi Mumbai"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 capitalize">{road.type}</td>
                                <td className="px-4 py-3 font-mono font-bold text-rose-600">
                                  {road.rhi?.toFixed(2)} /100
                                </td>
                                <td className="px-4 py-3 font-mono font-semibold">{road.defect_count}</td>
                                <td className="px-4 py-3">
                                  {road.rhi !== null && (
                                    <RhiBadge rhi={road.rhi} showScore={false} size="sm" />
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setScheduleRoad(road);
                                      setScheduleError(null);
                                      setMaintenanceType(MAINTENANCE_TYPES[0]);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Schedule Repair
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {activeTab === "manage" && (
                  <section className="panel overflow-hidden">
                    <div className="border-b border-border px-4 py-3">
                      <h2 className="text-sm font-semibold text-foreground">Active Repairs</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Update work progress or move a finished repair into history.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">ID / Repair Type</th>
                            <th className="px-4 py-3">Road</th>
                            <th className="px-4 py-3">Scheduled</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Progress</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {maintenance.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                                No active repair records for this ward.
                              </td>
                            </tr>
                          ) : (
                            maintenance.map((record) => (
                              <tr key={record.id} className="hover:bg-muted/30">
                                <td className="px-4 py-3">
                                  <span className="block font-mono font-bold">#{record.id}</span>
                                  <span className="text-muted-foreground">{record.maintenance_type}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="block font-semibold">{record.road_name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    #{record.road_id} • {record.road_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3">{formatDate(record.scheduled_date)}</td>
                                <td className="px-4 py-3">
                                  <span className="rounded bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-blue-700">
                                    {record.status.replaceAll("_", " ")}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <label className="sr-only" htmlFor={`progress-${record.id}`}>Progress percentage</label>
                                  <div className="flex items-center gap-1">
                                    <input
                                      id={`progress-${record.id}`}
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={progressValues[record.id] ?? String(record.progress)}
                                      onChange={(event) =>
                                        setProgressValues((current) => ({
                                          ...current,
                                          [record.id]: event.target.value,
                                        }))
                                      }
                                      className="w-20 rounded border border-input bg-background px-2 py-1.5 font-mono"
                                    />
                                    <span>%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={updatingId === record.id}
                                      onClick={() => void handleUpdateProgress(record)}
                                      className="rounded bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                                    >
                                      {updatingId === record.id ? "Updating..." : "Update Progress"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={updatingId === record.id}
                                      onClick={() => void handleCompleteRepair(record)}
                                      className="rounded bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50"
                                    >
                                      {updatingId === record.id ? "Working..." : "Repair Complete"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {activeTab === "history" && (
                  <section className="panel overflow-hidden">
                    <div className="border-b border-border px-4 py-3">
                      <h2 className="text-sm font-semibold text-foreground">Repair History</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Record ID</th>
                            <th className="px-4 py-3">Road</th>
                            <th className="px-4 py-3">Repair Type</th>
                            <th className="px-4 py-3">Start Date</th>
                            <th className="px-4 py-3">Completed Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {history.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                                No repair history for this ward.
                              </td>
                            </tr>
                          ) : (
                            history.map((record) => (
                              <tr key={record.id}>
                                <td className="px-4 py-3 font-mono font-bold">#{record.id}</td>
                                <td className="px-4 py-3">
                                  {record.road_name}
                                  <span className="block text-[10px] text-muted-foreground">
                                    #{record.road_id} • {record.road_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3">{record.maintenance_type}</td>
                                <td className="px-4 py-3">{formatDate(record.start_date)}</td>
                                <td className="px-4 py-3">{formatDate(record.completed_date)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      {scheduleRoad && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setScheduleRoad(null);
          }}
        >
          <form
            onSubmit={handleSchedule}
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
            aria-labelledby="schedule-repair-title"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 id="schedule-repair-title" className="text-base font-semibold text-foreground">
                  Schedule Repair
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scheduleRoad.name} • Road #{scheduleRoad.id}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setScheduleRoad(null)}
                className="rounded p-2 text-muted-foreground hover:bg-muted"
                aria-label="Close schedule repair form"
              >
                ×
              </button>
            </div>

            {scheduleError && (
              <div role="alert" className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700">
                {scheduleError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium">
                <span className="label-caps">Road ID</span>
                <input
                  type="number"
                  value={scheduleRoad.id}
                  readOnly
                  className="w-full rounded-md border border-input bg-muted px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span className="label-caps">Scheduled Date</span>
                <input
                  type="datetime-local"
                  required
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span className="label-caps">Maintenance Type</span>
                <select
                  required
                  value={maintenanceType}
                  onChange={(event) => setMaintenanceType(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  {MAINTENANCE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setScheduleRoad(null)}
                className="rounded-md border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Schedule Repair
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
