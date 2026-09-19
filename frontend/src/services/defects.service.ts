import { defects as initialDefects } from "@/mock-data/defects";
import { roads } from "@/mock-data/roads";
import type { Defect, DefectStatus, DefectType, Severity } from "@/types";

let currentDefects: Defect[] = [...initialDefects];

export interface DefectFilter {
  roadId?: string;
  type?: DefectType;
  severity?: Severity;
  status?: DefectStatus;
  stateId?: string;
  districtId?: string;
  cityId?: string;
  search?: string;
}

export const defectsService = {
  async getDefects(filter?: DefectFilter): Promise<Defect[]> {
    let result = [...currentDefects];

    if (filter?.roadId) {
      result = result.filter((d) => d.roadId === filter.roadId);
    }
    if (filter?.type) {
      result = result.filter((d) => d.type === filter.type);
    }
    if (filter?.severity) {
      result = result.filter((d) => d.severity === filter.severity);
    }
    if (filter?.status) {
      result = result.filter((d) => d.status === filter.status);
    }

    if (filter?.stateId || filter?.districtId || filter?.cityId) {
      const roadMap = new Map(roads.map((r) => [r.id, r]));
      result = result.filter((d) => {
        const road = roadMap.get(d.roadId);
        if (!road) return false;
        if (filter.stateId && road.stateId !== filter.stateId) return false;
        if (filter.districtId && road.districtId !== filter.districtId) return false;
        if (filter.cityId && road.cityId !== filter.cityId) return false;
        return true;
      });
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.id.toLowerCase().includes(q) ||
          d.roadId.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          d.notes.toLowerCase().includes(q)
      );
    }

    return result;
  },

  async getDefectById(id: string): Promise<Defect | undefined> {
    return currentDefects.find((d) => d.id === id);
  },

  async updateDefectStatus(id: string, status: DefectStatus): Promise<Defect> {
    const idx = currentDefects.findIndex((d) => d.id === id);
    if (idx === -1) {
      throw new Error(`Defect ${id} not found`);
    }
    const updated: Defect = {
      ...currentDefects[idx],
      status,
    };
    currentDefects[idx] = updated;
    return updated;
  },
};
