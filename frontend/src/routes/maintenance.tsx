import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  HardHat,
  Layers,
  Plus,
  Search,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MaintenanceModal } from "@/components/maintenance/MaintenanceModal";
import { PriorityBadge } from "@/components/road/RhiBadge";
import { useAreaFilter } from "@/hooks/useAreaFilter";
import { formatDate } from "@/lib/rhi";
import { maintenanceService } from "@/services/maintenance.service";
import { roadsService } from "@/services/roads.service";
import type { MaintenanceStatus, MaintenanceTask, Priority, Road } from "@/types";

export const Route = createFileRoute("/maintenance")({
  component: MaintenancePage,
});

function MaintenancePage() {
  const areaFilter = useAreaFilter();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | MaintenanceStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [roadsData, tasksData] = await Promise.all([
        roadsService.getRoads({
          stateId: areaFilter.stateId,
          districtId: areaFilter.districtId,
          cityId: areaFilter.cityId,
        }),
        maintenanceService.getMaintenanceTasks(),
      ]);

      setRoads(roadsData);
      const roadIds = new Set(roadsData.map((r) => r.id));
      setTasks(tasksData.filter((t) => roadIds.has(t.roadId)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [areaFilter.stateId, areaFilter.districtId, areaFilter.cityId]);

  const handleUpdateStatus = async (id: string, status: MaintenanceStatus) => {
    await maintenanceService.updateMaintenanceTask(id, { status });
    await loadData();
  };

  const handleCreateTask = async (task: Omit<MaintenanceTask, "id">) => {
    await maintenanceService.createMaintenanceTask(task);
    await loadData();
  };

  const roadMap = new Map(roads.map((r) => [r.id, r]));

  const filteredTasks = tasks.filter((t) => {
    if (activeTab !== "all" && t.status !== activeTab) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const road = roadMap.get(t.roadId);
      const matches =
        t.id.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.contractor.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        (road && (road.code.toLowerCase().includes(q) || road.name.toLowerCase().includes(q)));
      if (!matches) return false;
    }
    return true;
  });

  const scheduledCount = tasks.filter((t) => t.status === "scheduled").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalBudgetLakh = tasks.reduce((sum, t) => sum + t.estimatedCostLakh, 0);

  return (
    <AppShell
      areaFilter={areaFilter}
      title="Predictive Maintenance & Work Orders"
      subtitle="AI-prioritized pavement resurfacing, crack sealing & pothole patching operations"
      actions={
        <button
          onClick={() => setScheduleModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Work Order</span>
        </button>
      }
    >
      <div className="space-y-4 p-4 lg:p-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="panel p-3.5 border-l-4 border-l-amber-500">
            <span className="label-caps">Pending & Scheduled</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600">
              {pendingCount + scheduledCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {pendingCount} awaiting approval, {scheduledCount} ready
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-blue-500">
            <span className="label-caps">In Progress Works</span>
            <div className="mt-1 text-2xl font-bold font-mono text-blue-600">
              {inProgressCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Active field contractors deployed
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-emerald-500">
            <span className="label-caps">Completed Interventions</span>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">
              {completedCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Rectified in current fiscal year
            </div>
          </div>

          <div className="panel p-3.5 border-l-4 border-l-primary">
            <span className="label-caps">Committed Budget</span>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">
              ₹{totalBudgetLakh.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">L</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Total expenditure across tasks
            </div>
          </div>
        </div>

        {/* Status Tabs and Filter Toolbar */}
        <div className="panel p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-border pb-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {[
                { id: "all", label: "All Work Orders", count: tasks.length },
                { id: "in_progress", label: "In Progress", count: inProgressCount },
                { id: "scheduled", label: "Scheduled", count: scheduledCount },
                { id: "pending", label: "Pending Budget", count: pendingCount },
                { id: "completed", label: "Completed", count: completedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px]">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground cursor-pointer shrink-0"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search task ID, corridor, or contractor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <span className="text-xs text-muted-foreground font-mono">
              Showing {filteredTasks.length} work orders
            </span>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Task ID / Type</th>
                  <th className="px-4 py-3">Corridor & Chainage</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-4 py-3">Contractor</th>
                  <th className="px-4 py-3">Est. Budget</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Update Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No maintenance work orders found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const road = roadMap.get(task.roadId);
                    return (
                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground block">
                            {task.id}
                          </span>
                          <span className="font-semibold text-foreground text-xs">
                            {task.type}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-foreground">
                            {road?.code || task.roadId}
                          </span>
                          <span className="text-muted-foreground text-[11px] block">
                            Ch. {task.chainageFrom} → {task.chainageTo} km • {road?.name}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <PriorityBadge priority={task.priority} />
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(task.scheduledDate)}
                          {task.completedDate && (
                            <span className="block text-[10px] text-emerald-600 font-medium">
                              Done: {formatDate(task.completedDate)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-foreground font-medium">
                          {task.contractor}
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          ₹{task.estimatedCostLakh} L
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              task.status === "in_progress"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : task.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : task.status === "scheduled"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {task.status.replace("_", " ")}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {task.status !== "in_progress" && task.status !== "completed" && (
                              <button
                                onClick={() => handleUpdateStatus(task.id, "in_progress")}
                                className="rounded bg-blue-50 text-blue-700 px-2 py-1 text-[11px] font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                Start Work
                              </button>
                            )}

                            {task.status === "in_progress" && (
                              <button
                                onClick={() => handleUpdateStatus(task.id, "completed")}
                                className="rounded bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                Mark Complete
                              </button>
                            )}

                            {task.status === "completed" && (
                              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Maintenance Work Order Modal */}
      <MaintenanceModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        roads={roads}
        onSave={handleCreateTask}
      />
    </AppShell>
  );
}
