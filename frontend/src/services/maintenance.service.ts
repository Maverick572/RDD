import { maintenanceTasks as initialTasks } from "@/mock-data/maintenance";
import type { MaintenanceStatus, MaintenanceTask, Priority } from "@/types";

let currentTasks: MaintenanceTask[] = [...initialTasks];

export interface MaintenanceFilter {
  status?: MaintenanceStatus;
  roadId?: string;
  priority?: Priority;
  search?: string;
}

export const maintenanceService = {
  async getMaintenanceTasks(filter?: MaintenanceFilter): Promise<MaintenanceTask[]> {
    let result = [...currentTasks];

    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter?.roadId) {
      result = result.filter((t) => t.roadId === filter.roadId);
    }
    if (filter?.priority) {
      result = result.filter((t) => t.priority === filter.priority);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.roadId.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          t.contractor.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q)
      );
    }

    return result;
  },

  async getMaintenanceTaskById(id: string): Promise<MaintenanceTask | undefined> {
    return currentTasks.find((t) => t.id === id);
  },

  async createMaintenanceTask(
    payload: Omit<MaintenanceTask, "id">
  ): Promise<MaintenanceTask> {
    const nextNum = currentTasks.length + 155;
    const newTask: MaintenanceTask = {
      ...payload,
      id: `MT-2026-0${nextNum}`,
    };
    currentTasks = [newTask, ...currentTasks];
    return newTask;
  },

  async updateMaintenanceTask(
    id: string,
    updates: Partial<MaintenanceTask>
  ): Promise<MaintenanceTask> {
    const idx = currentTasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Maintenance task ${id} not found`);
    }

    const updated: MaintenanceTask = {
      ...currentTasks[idx],
      ...updates,
      completedDate:
        updates.status === "completed" && !currentTasks[idx].completedDate
          ? new Date().toISOString().slice(0, 10)
          : updates.completedDate !== undefined
            ? updates.completedDate
            : currentTasks[idx].completedDate,
    };
    currentTasks[idx] = updated;
    return updated;
  },
};
