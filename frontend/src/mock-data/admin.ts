import type { CityArea, DistrictArea, StateArea } from "@/types";

export const INDIA = {
  center: [22.5, 80] as [number, number],
  zoom: 5,
  bounds: [
    [6.5, 68],
    [36, 97.5],
  ] as [[number, number], [number, number]],
};

export const states: StateArea[] = [
  { id: "MH", code: "MH", name: "Maharashtra", center: [19.3, 76.2], zoom: 7, bounds: [[15.6, 72.6], [22.1, 80.9]] },
  { id: "KA", code: "KA", name: "Karnataka", center: [15.0, 76.2], zoom: 7, bounds: [[11.6, 74.0], [18.4, 78.6]] },
  { id: "TN", code: "TN", name: "Tamil Nadu", center: [10.9, 78.4], zoom: 7, bounds: [[8.0, 76.2], [13.6, 80.4]] },
  { id: "DL", code: "DL", name: "Delhi", center: [28.62, 77.15], zoom: 10, bounds: [[28.4, 76.85], [28.9, 77.35]] },
  { id: "GJ", code: "GJ", name: "Gujarat", center: [22.4, 71.5], zoom: 7, bounds: [[20.1, 68.1], [24.7, 74.5]] },
];

export const districts: DistrictArea[] = [
  { id: "MH-PUN", stateId: "MH", name: "Pune", center: [18.55, 73.85], zoom: 11, bounds: [[18.38, 73.65], [18.75, 74.05]] },
  { id: "MH-MUM", stateId: "MH", name: "Mumbai Suburban", center: [19.12, 72.88], zoom: 11, bounds: [[19.0, 72.78], [19.28, 72.98]] },
  { id: "KA-BLR", stateId: "KA", name: "Bengaluru Urban", center: [12.97, 77.59], zoom: 11, bounds: [[12.83, 77.45], [13.12, 77.75]] },
  { id: "KA-MYS", stateId: "KA", name: "Mysuru", center: [12.3, 76.65], zoom: 12, bounds: [[12.22, 76.56], [12.38, 76.74]] },
  { id: "TN-CHE", stateId: "TN", name: "Chennai", center: [13.07, 80.24], zoom: 11, bounds: [[12.95, 80.14], [13.2, 80.32]] },
  { id: "DL-NDL", stateId: "DL", name: "New Delhi", center: [28.61, 77.2], zoom: 12, bounds: [[28.55, 77.13], [28.67, 77.27]] },
  { id: "GJ-AMD", stateId: "GJ", name: "Ahmedabad", center: [23.03, 72.57], zoom: 11, bounds: [[22.93, 72.47], [23.13, 72.68]] },
];

export const cities: CityArea[] = [
  { id: "PMC", districtId: "MH-PUN", stateId: "MH", name: "Pune Municipal Corporation", kind: "Municipal Corporation", center: [18.52, 73.86], zoom: 13, bounds: [[18.48, 73.81], [18.56, 73.91]] },
  { id: "PCMC", districtId: "MH-PUN", stateId: "MH", name: "Pimpri-Chinchwad MC", kind: "Municipal Corporation", center: [18.63, 73.8], zoom: 13, bounds: [[18.6, 73.76], [18.67, 73.84]] },
  { id: "BMC-W", districtId: "MH-MUM", stateId: "MH", name: "BMC – Western Suburbs", kind: "Municipal Corporation", center: [19.12, 72.85], zoom: 13, bounds: [[19.08, 72.82], [19.16, 72.88]] },
  { id: "BBMP", districtId: "KA-BLR", stateId: "KA", name: "Bruhat Bengaluru MP", kind: "Municipal Corporation", center: [12.97, 77.6], zoom: 13, bounds: [[12.93, 77.56], [13.01, 77.64]] },
  { id: "MCC", districtId: "KA-MYS", stateId: "KA", name: "Mysuru City Corporation", kind: "Municipal Corporation", center: [12.3, 76.65], zoom: 13, bounds: [[12.28, 76.62], [12.33, 76.68]] },
  { id: "GCC", districtId: "TN-CHE", stateId: "TN", name: "Greater Chennai Corporation", kind: "Municipal Corporation", center: [13.06, 80.25], zoom: 13, bounds: [[13.02, 80.21], [13.1, 80.29]] },
  { id: "NDMC", districtId: "DL-NDL", stateId: "DL", name: "New Delhi Municipal Council", kind: "NDMC", center: [28.62, 77.21], zoom: 13, bounds: [[28.59, 77.17], [28.65, 77.25]] },
  { id: "AMC", districtId: "GJ-AMD", stateId: "GJ", name: "Ahmedabad Municipal Corp", kind: "Municipal Corporation", center: [23.03, 72.57], zoom: 13, bounds: [[22.99, 72.53], [23.07, 72.61]] },
];
