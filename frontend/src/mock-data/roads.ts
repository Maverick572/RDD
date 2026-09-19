import type { MaintenanceStatus, MaintenanceType, Priority, RhiHistoryPoint, Road } from "@/types";

type Coord = [number, number]; // [lng, lat]

interface RoadSeed {
  id: string;
  code: string;
  name: string;
  cityId: string;
  districtId: string;
  stateId: string;
  category: Road["category"];
  surface?: Road["surface"];
  lengthKm: number;
  lanes: number;
  rhi: number;
  defectCount: number;
  lastInspection: string;
  maintenance: { status: MaintenanceStatus; type: MaintenanceType; scheduledDate: string | null; lastCompleted: string | null };
  coords: Coord[];
}

const priorityFor = (rhi: number, defects: number): Priority => {
  if (rhi < 30 || defects >= 14) return "critical";
  if (rhi < 50 || defects >= 8) return "high";
  if (rhi < 75) return "medium";
  return "low";
};

/** Deterministic 12-month RHI history ending at the current value. */
const history = (rhi: number, seed: number): RhiHistoryPoint[] => {
  const points: RhiHistoryPoint[] = [];
  let v = Math.min(98, rhi + 9 + (seed % 5));
  for (let i = 11; i >= 0; i--) {
    const d = new Date(2026, 8 - i, 1);
    const wobble = ((seed * (i + 3)) % 7) - 3;
    const val = i === 0 ? rhi : Math.round(Math.max(rhi, v) + wobble * 0.4);
    points.push({ date: d.toISOString().slice(0, 10), rhi: Math.max(5, Math.min(99, val)) });
    v -= (v - rhi) / (i + 1);
  }
  return points;
};

const seeds: RoadSeed[] = [
  // Pune — PMC
  { id: "R-PMC-001", code: "PMC/AR/014", name: "Jangli Maharaj Road", cityId: "PMC", districtId: "MH-PUN", stateId: "MH", category: "Arterial", lengthKm: 2.4, lanes: 4, rhi: 38, defectCount: 12, lastInspection: "2026-09-02", maintenance: { status: "scheduled", type: "Pothole patching", scheduledDate: "2026-09-28", lastCompleted: "2025-11-14" }, coords: [[73.842, 18.5215], [73.848, 18.5235], [73.854, 18.5262], [73.859, 18.5288]] },
  { id: "R-PMC-002", code: "PMC/AR/021", name: "Fergusson College Road", cityId: "PMC", districtId: "MH-PUN", stateId: "MH", category: "Arterial", lengthKm: 1.9, lanes: 4, rhi: 71, defectCount: 4, lastInspection: "2026-09-02", maintenance: { status: "completed", type: "Crack sealing", scheduledDate: null, lastCompleted: "2026-06-20" }, coords: [[73.8395, 18.5165], [73.8405, 18.522], [73.8415, 18.528], [73.842, 18.5335]] },
  { id: "R-PMC-003", code: "PMC/SA/007", name: "Karve Road", cityId: "PMC", districtId: "MH-PUN", stateId: "MH", category: "Sub-arterial", lengthKm: 3.1, lanes: 4, rhi: 24, defectCount: 17, lastInspection: "2026-08-27", maintenance: { status: "in_progress", type: "Resurfacing", scheduledDate: "2026-09-10", lastCompleted: "2024-02-11" }, coords: [[73.838, 18.5065], [73.832, 18.5035], [73.824, 18.501], [73.815, 18.4995], [73.806, 18.499]] },
  { id: "R-PMC-004", code: "PMC/CO/112", name: "Law College Road", cityId: "PMC", districtId: "MH-PUN", stateId: "MH", category: "Collector", lengthKm: 1.6, lanes: 2, rhi: 82, defectCount: 1, lastInspection: "2026-08-27", maintenance: { status: "completed", type: "Micro-surfacing", scheduledDate: null, lastCompleted: "2026-03-05" }, coords: [[73.829, 18.5165], [73.8305, 18.512], [73.833, 18.508], [73.836, 18.5045]] },
  { id: "R-PMC-005", code: "PMC/AR/003", name: "Bund Garden Road", cityId: "PMC", districtId: "MH-PUN", stateId: "MH", category: "Arterial", lengthKm: 2.2, lanes: 6, rhi: 56, defectCount: 7, lastInspection: "2026-09-05", maintenance: { status: "pending", type: "Lane re-marking", scheduledDate: null, lastCompleted: "2025-08-01" }, coords: [[73.868, 18.531], [73.874, 18.5335], [73.881, 18.5365], [73.888, 18.539]] },
  // Pune — PCMC
  { id: "R-PCMC-001", code: "PCMC/AR/002", name: "Old Mumbai–Pune Highway (Pimpri)", cityId: "PCMC", districtId: "MH-PUN", stateId: "MH", category: "State Highway", lengthKm: 4.8, lanes: 6, rhi: 61, defectCount: 6, lastInspection: "2026-08-30", maintenance: { status: "scheduled", type: "Crack sealing", scheduledDate: "2026-10-06", lastCompleted: "2025-12-02" }, coords: [[73.77, 18.6135], [73.785, 18.6235], [73.8, 18.634], [73.815, 18.6455]] },
  { id: "R-PCMC-002", code: "PCMC/SA/019", name: "Telco Road", cityId: "PCMC", districtId: "MH-PUN", stateId: "MH", category: "Sub-arterial", lengthKm: 3.4, lanes: 4, rhi: 44, defectCount: 9, lastInspection: "2026-08-30", maintenance: { status: "pending", type: "Pothole patching", scheduledDate: null, lastCompleted: "2025-05-19" }, coords: [[73.79, 18.6435], [73.802, 18.6415], [73.816, 18.638], [73.828, 18.6355]] },
  { id: "R-PCMC-003", code: "PCMC/CO/054", name: "Spine Road", cityId: "PCMC", districtId: "MH-PUN", stateId: "MH", category: "Arterial", surface: "Concrete", lengthKm: 5.2, lanes: 6, rhi: 88, defectCount: 0, lastInspection: "2026-09-01", maintenance: { status: "completed", type: "Lane re-marking", scheduledDate: null, lastCompleted: "2026-07-12" }, coords: [[73.76, 18.6545], [73.775, 18.6595], [73.79, 18.664], [73.806, 18.667]] },
  // Mumbai — BMC West
  { id: "R-BMC-001", code: "BMC/WEH/K-W", name: "Western Express Highway (Andheri)", cityId: "BMC-W", districtId: "MH-MUM", stateId: "MH", category: "National Highway", lengthKm: 6.1, lanes: 8, rhi: 52, defectCount: 11, lastInspection: "2026-09-04", maintenance: { status: "in_progress", type: "Pothole patching", scheduledDate: "2026-09-08", lastCompleted: "2026-01-22" }, coords: [[72.855, 19.09], [72.858, 19.105], [72.861, 19.121], [72.864, 19.138], [72.868, 19.154]] },
  { id: "R-BMC-002", code: "BMC/SVR/H-W", name: "S.V. Road (Bandra–Santacruz)", cityId: "BMC-W", districtId: "MH-MUM", stateId: "MH", category: "Arterial", lengthKm: 3.7, lanes: 4, rhi: 29, defectCount: 15, lastInspection: "2026-09-04", maintenance: { status: "scheduled", type: "Resurfacing", scheduledDate: "2026-10-15", lastCompleted: "2024-10-30" }, coords: [[72.836, 19.06], [72.838, 19.072], [72.84, 19.084], [72.842, 19.096]] },
  { id: "R-BMC-003", code: "BMC/LNK/K-W", name: "Link Road (Andheri West)", cityId: "BMC-W", districtId: "MH-MUM", stateId: "MH", category: "Arterial", lengthKm: 4.2, lanes: 4, rhi: 67, defectCount: 5, lastInspection: "2026-08-25", maintenance: { status: "completed", type: "Micro-surfacing", scheduledDate: null, lastCompleted: "2026-05-15" }, coords: [[72.826, 19.115], [72.828, 19.13], [72.831, 19.145], [72.834, 19.158]] },
  // Bengaluru — BBMP
  { id: "R-BBMP-001", code: "BBMP/ORR/E-02", name: "Outer Ring Road (Marathahalli)", cityId: "BBMP", districtId: "KA-BLR", stateId: "KA", category: "Arterial", lengthKm: 5.5, lanes: 6, rhi: 47, defectCount: 10, lastInspection: "2026-09-03", maintenance: { status: "scheduled", type: "Crack sealing", scheduledDate: "2026-09-30", lastCompleted: "2025-09-09" }, coords: [[77.58, 12.94], [77.595, 12.948], [77.61, 12.958], [77.625, 12.968]] },
  { id: "R-BBMP-002", code: "BBMP/MG/C-01", name: "M.G. Road", cityId: "BBMP", districtId: "KA-BLR", stateId: "KA", category: "Arterial", lengthKm: 1.8, lanes: 4, rhi: 79, defectCount: 2, lastInspection: "2026-09-03", maintenance: { status: "completed", type: "Lane re-marking", scheduledDate: null, lastCompleted: "2026-04-18" }, coords: [[77.598, 12.975], [77.606, 12.9755], [77.614, 12.9745], [77.622, 12.9735]] },
  { id: "R-BBMP-003", code: "BBMP/HSR/S-14", name: "Hosur Road (Silk Board)", cityId: "BBMP", districtId: "KA-BLR", stateId: "KA", category: "National Highway", lengthKm: 3.9, lanes: 6, rhi: 33, defectCount: 14, lastInspection: "2026-08-29", maintenance: { status: "pending", type: "Resurfacing", scheduledDate: null, lastCompleted: "2024-12-01" }, coords: [[77.6, 12.955], [77.61, 12.945], [77.62, 12.936], [77.63, 12.927]] },
  { id: "R-BBMP-004", code: "BBMP/BLR/N-07", name: "Bellary Road (Hebbal)", cityId: "BBMP", districtId: "KA-BLR", stateId: "KA", category: "National Highway", lengthKm: 4.4, lanes: 6, rhi: 74, defectCount: 3, lastInspection: "2026-09-06", maintenance: { status: "scheduled", type: "Micro-surfacing", scheduledDate: "2026-11-02", lastCompleted: "2025-10-12" }, coords: [[77.588, 12.985], [77.59, 12.995], [77.592, 13.005], [77.594, 13.015]] },
  // Mysuru
  { id: "R-MCC-001", code: "MCC/AR/001", name: "Sayyaji Rao Road", cityId: "MCC", districtId: "KA-MYS", stateId: "KA", category: "Arterial", lengthKm: 2.1, lanes: 4, rhi: 84, defectCount: 1, lastInspection: "2026-08-20", maintenance: { status: "completed", type: "Pothole patching", scheduledDate: null, lastCompleted: "2026-02-14" }, coords: [[76.652, 12.295], [76.6535, 12.303], [76.655, 12.311], [76.6565, 12.319]] },
  { id: "R-MCC-002", code: "MCC/SA/016", name: "Hunsur Road", cityId: "MCC", districtId: "KA-MYS", stateId: "KA", category: "State Highway", lengthKm: 3.6, lanes: 4, rhi: 58, defectCount: 6, lastInspection: "2026-08-20", maintenance: { status: "pending", type: "Crack sealing", scheduledDate: null, lastCompleted: "2025-07-07" }, coords: [[76.645, 12.31], [76.636, 12.314], [76.627, 12.318], [76.618, 12.322]] },
  // Chennai
  { id: "R-GCC-001", code: "GCC/AR/004", name: "Anna Salai", cityId: "GCC", districtId: "TN-CHE", stateId: "TN", category: "Arterial", lengthKm: 4.6, lanes: 6, rhi: 63, defectCount: 7, lastInspection: "2026-09-01", maintenance: { status: "scheduled", type: "Lane re-marking", scheduledDate: "2026-09-25", lastCompleted: "2025-12-19" }, coords: [[80.28, 13.075], [80.27, 13.065], [80.26, 13.055], [80.25, 13.045], [80.24, 13.036]] },
  { id: "R-GCC-002", code: "GCC/AR/011", name: "OMR (Rajiv Gandhi Salai)", cityId: "GCC", districtId: "TN-CHE", stateId: "TN", category: "State Highway", surface: "Concrete", lengthKm: 5.8, lanes: 6, rhi: 77, defectCount: 3, lastInspection: "2026-09-01", maintenance: { status: "completed", type: "Crack sealing", scheduledDate: null, lastCompleted: "2026-06-02" }, coords: [[80.245, 13.03], [80.242, 13.02], [80.239, 13.01], [80.236, 13.0]] },
  { id: "R-GCC-003", code: "GCC/SA/032", name: "Poonamallee High Road", cityId: "GCC", districtId: "TN-CHE", stateId: "TN", category: "Arterial", lengthKm: 3.8, lanes: 4, rhi: 41, defectCount: 9, lastInspection: "2026-08-28", maintenance: { status: "in_progress", type: "Pothole patching", scheduledDate: "2026-09-05", lastCompleted: "2025-03-11" }, coords: [[80.27, 13.08], [80.258, 13.079], [80.246, 13.078], [80.234, 13.077]] },
  // Delhi — NDMC
  { id: "R-NDMC-001", code: "NDMC/AR/001", name: "Janpath", cityId: "NDMC", districtId: "DL-NDL", stateId: "DL", category: "Arterial", lengthKm: 2.3, lanes: 4, rhi: 86, defectCount: 1, lastInspection: "2026-09-06", maintenance: { status: "completed", type: "Micro-surfacing", scheduledDate: null, lastCompleted: "2026-01-10" }, coords: [[77.219, 28.632], [77.2185, 28.624], [77.218, 28.616], [77.2175, 28.608]] },
  { id: "R-NDMC-002", code: "NDMC/AR/009", name: "Ring Road (Sarai Kale Khan)", cityId: "NDMC", districtId: "DL-NDL", stateId: "DL", category: "Arterial", lengthKm: 4.9, lanes: 8, rhi: 49, defectCount: 8, lastInspection: "2026-09-06", maintenance: { status: "scheduled", type: "Pothole patching", scheduledDate: "2026-09-22", lastCompleted: "2025-11-25" }, coords: [[77.24, 28.6], [77.25, 28.595], [77.26, 28.59], [77.27, 28.588]] },
  { id: "R-NDMC-003", code: "NDMC/SA/021", name: "Lodhi Road", cityId: "NDMC", districtId: "DL-NDL", stateId: "DL", category: "Sub-arterial", lengthKm: 2.0, lanes: 4, rhi: 69, defectCount: 4, lastInspection: "2026-08-31", maintenance: { status: "pending", type: "Lane re-marking", scheduledDate: null, lastCompleted: "2025-06-30" }, coords: [[77.215, 28.591], [77.225, 28.5905], [77.235, 28.59], [77.245, 28.5895]] },
  // Ahmedabad
  { id: "R-AMC-001", code: "AMC/AR/005", name: "Ashram Road", cityId: "AMC", districtId: "GJ-AMD", stateId: "GJ", category: "Arterial", lengthKm: 3.3, lanes: 6, rhi: 72, defectCount: 4, lastInspection: "2026-09-02", maintenance: { status: "completed", type: "Crack sealing", scheduledDate: null, lastCompleted: "2026-05-05" }, coords: [[72.572, 23.015], [72.5725, 23.025], [72.573, 23.035], [72.5735, 23.045]] },
  { id: "R-AMC-002", code: "AMC/AR/012", name: "S.G. Highway", cityId: "AMC", districtId: "GJ-AMD", stateId: "GJ", category: "State Highway", lengthKm: 6.4, lanes: 8, rhi: 81, defectCount: 2, lastInspection: "2026-09-02", maintenance: { status: "scheduled", type: "Lane re-marking", scheduledDate: "2026-10-20", lastCompleted: "2025-12-12" }, coords: [[72.51, 23.005], [72.512, 23.02], [72.514, 23.035], [72.516, 23.05]] },
  { id: "R-AMC-003", code: "AMC/CO/077", name: "C.G. Road", cityId: "AMC", districtId: "GJ-AMD", stateId: "GJ", category: "Sub-arterial", lengthKm: 1.7, lanes: 4, rhi: 35, defectCount: 13, lastInspection: "2026-08-26", maintenance: { status: "pending", type: "Resurfacing", scheduledDate: null, lastCompleted: "2024-08-18" }, coords: [[72.556, 23.02], [72.557, 23.028], [72.558, 23.036], [72.559, 23.044]] },
];

const addMonths = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

export const roads: Road[] = seeds.map((s, i) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  stateId: s.stateId,
  districtId: s.districtId,
  cityId: s.cityId,
  category: s.category,
  surface: s.surface ?? "Bituminous",
  lengthKm: s.lengthKm,
  lanes: s.lanes,
  rhi: s.rhi,
  priority: priorityFor(s.rhi, s.defectCount),
  lastInspection: s.lastInspection,
  nextInspection: addMonths(s.lastInspection, s.rhi < 50 ? 1 : 3),
  defectCount: s.defectCount,
  maintenance: s.maintenance,
  rhiHistory: history(s.rhi, i + 7),
  geometry: { type: "LineString", coordinates: s.coords },
}));
