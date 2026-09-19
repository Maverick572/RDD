import { useState, useCallback, useEffect } from "react";
import { adminService } from "@/services/admin.service";
import type { CityArea, DistrictArea, StateArea, AreaFilter } from "@/types";

export interface AreaFilterState extends AreaFilter {
  selectedState?: StateArea;
  selectedDistrict?: DistrictArea;
  selectedCity?: CityArea;
  states: StateArea[];
  districts: DistrictArea[];
  cities: CityArea[];
  setStateId: (id: string | undefined) => void;
  setDistrictId: (id: string | undefined) => void;
  setCityId: (id: string | undefined) => void;
  resetFilter: () => void;
}

export function useAreaFilter(initialFilter?: AreaFilter): AreaFilterState {
  const [stateId, setStateIdState] = useState<string | undefined>(initialFilter?.stateId);
  const [districtId, setDistrictIdState] = useState<string | undefined>(initialFilter?.districtId);
  const [cityId, setCityIdState] = useState<string | undefined>(initialFilter?.cityId);

  const [states, setStates] = useState<StateArea[]>([]);
  const [districts, setDistricts] = useState<DistrictArea[]>([]);
  const [cities, setCities] = useState<CityArea[]>([]);

  useEffect(() => {
    adminService.getStates().then(setStates);
  }, []);

  useEffect(() => {
    adminService.getDistricts(stateId).then((res) => {
      setDistricts(res);
      if (districtId && !res.some((d) => d.id === districtId)) {
        setDistrictIdState(undefined);
        setCityIdState(undefined);
      }
    });
  }, [stateId]);

  useEffect(() => {
    adminService.getCities(districtId, stateId).then((res) => {
      setCities(res);
      if (cityId && !res.some((c) => c.id === cityId)) {
        setCityIdState(undefined);
      }
    });
  }, [districtId, stateId]);

  const setStateId = useCallback((id: string | undefined) => {
    setStateIdState(id);
    setDistrictIdState(undefined);
    setCityIdState(undefined);
  }, []);

  const setDistrictId = useCallback((id: string | undefined) => {
    setDistrictIdState(id);
    setCityIdState(undefined);
  }, []);

  const setCityId = useCallback((id: string | undefined) => {
    setCityIdState(id);
  }, []);

  const resetFilter = useCallback(() => {
    setStateIdState(undefined);
    setDistrictIdState(undefined);
    setCityIdState(undefined);
  }, []);

  const selectedState = states.find((s) => s.id === stateId);
  const selectedDistrict = districts.find((d) => d.id === districtId);
  const selectedCity = cities.find((c) => c.id === cityId);

  return {
    stateId,
    districtId,
    cityId,
    selectedState,
    selectedDistrict,
    selectedCity,
    states,
    districts,
    cities,
    setStateId,
    setDistrictId,
    setCityId,
    resetFilter,
  };
}
