import { cities, districts, states, INDIA } from "@/mock-data/admin";
import type { CityArea, DistrictArea, StateArea, AreaFilter } from "@/types";

export const adminService = {
  getIndiaOverview() {
    return INDIA;
  },

  async getStates(): Promise<StateArea[]> {
    return states;
  },

  async getStateById(id: string): Promise<StateArea | undefined> {
    return states.find((s) => s.id === id);
  },

  async getDistricts(stateId?: string): Promise<DistrictArea[]> {
    if (!stateId) return districts;
    return districts.filter((d) => d.stateId === stateId);
  },

  async getDistrictById(id: string): Promise<DistrictArea | undefined> {
    return districts.find((d) => d.id === id);
  },

  async getCities(districtId?: string, stateId?: string): Promise<CityArea[]> {
    let result = cities;
    if (stateId) {
      result = result.filter((c) => c.stateId === stateId);
    }
    if (districtId) {
      result = result.filter((c) => c.districtId === districtId);
    }
    return result;
  },

  async getCityById(id: string): Promise<CityArea | undefined> {
    return cities.find((c) => c.id === id);
  },

  async getAreaHierarchy(filter?: AreaFilter) {
    const state = filter?.stateId ? states.find((s) => s.id === filter.stateId) : undefined;
    const district = filter?.districtId ? districts.find((d) => d.id === filter.districtId) : undefined;
    const city = filter?.cityId ? cities.find((c) => c.id === filter.cityId) : undefined;

    return {
      state,
      district,
      city,
    };
  },
};
