import type { Defect, DefectStatus, DefectType, Severity } from "@/types";
import { roads } from "./roads";

/**
 * Defects are generated deterministically along each road's geometry so the
 * markers always sit on the road. Counts match `road.defectCount`.
 */
const TYPES: DefectType[] = ["pothole", "crack", "faded_marking", "pothole", "crack", "rutting", "edge_break", "pothole"];
const SEVERITIES: Severity[] = ["medium", "high", "low", "high", "medium", "low", "medium"];
const STATUSES: DefectStatus[] = ["open", "open", "scheduled", "open", "repaired", "open"];
const NOTES: Record<DefectType, string> = {
  pothole: "Bowl-shaped depression, standing water risk during monsoon.",
  crack: "Longitudinal / alligator cracking, moisture ingress likely.",
  faded_marking: "Lane marking retro-reflectivity below IRC:35 threshold.",
  rutting: "Wheel-path deformation measured in outer lane.",
  edge_break: "Shoulder edge breaking, unsupported pavement edge.",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function pointAlong(coords: number[][], t: number): [number, number] {
  const segs = coords.length - 1;
  const f = t * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const lt = f - i;
  const [lng, lat] = [lerp(coords[i][0], coords[i + 1][0], lt), lerp(coords[i][1], coords[i + 1][1], lt)];
  return [lat, lng];
}

export const defects: Defect[] = roads.flatMap((road, ri) =>
  Array.from({ length: road.defectCount }, (_, k) => {
    const seed = ri * 13 + k * 7;
    const type = TYPES[seed % TYPES.length];
    const t = (k + 0.5) / road.defectCount;
    const daysAgo = (seed % 40) + 2;
    const detected = new Date(2026, 8, 7 - daysAgo);
    return {
      id: `D-${road.id.replace("R-", "")}-${String(k + 1).padStart(2, "0")}`,
      roadId: road.id,
      type,
      severity: SEVERITIES[(seed + ri) % SEVERITIES.length],
      status: STATUSES[(seed + k) % STATUSES.length],
      location: pointAlong(road.geometry.coordinates, t),
      chainageKm: Math.round(t * road.lengthKm * 100) / 100,
      detectedAt: detected.toISOString(),
      confidence: Math.round((0.78 + ((seed % 21) / 100)) * 100) / 100,
      areaM2: type === "faded_marking" ? Math.round((4 + (seed % 9)) * 10) / 10 : Math.round((0.2 + (seed % 15) / 10) * 10) / 10,
      imageId: `IMG-${road.id}-${(k % 3) + 1}-${(k % 2) + 1}`,
      notes: NOTES[type],
    } satisfies Defect;
  }),
);
