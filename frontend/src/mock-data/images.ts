import type { Inspection, RoadImage } from "@/types";
import { rhiBand } from "@/lib/rhi";
import { roads } from "./roads";
import imgPothole from "@/assets/inspection-pothole.jpg";
import imgCracks from "@/assets/inspection-cracks.jpg";
import imgMarkings from "@/assets/inspection-markings.jpg";
import imgGood from "@/assets/inspection-good.jpg";

/** Placeholder frames — the real backend returns per-image URLs. */
const FRAMES = { good: imgGood, fair: imgMarkings, poor: imgCracks, critical: imgPothole } as const;
const ALL_FRAMES = [imgGood, imgMarkings, imgCracks, imgPothole];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function pointAlong(coords: number[][], t: number): [number, number] {
  const segs = coords.length - 1;
  const f = t * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const lt = f - i;
  return [lerp(coords[i][1], coords[i + 1][1], lt), lerp(coords[i][0], coords[i + 1][0], lt)];
}

const VEHICLES = ["RSV-MH-02", "RSV-KA-01", "RSV-TN-03", "RSV-DL-01", "RSV-GJ-02"];

export const inspections: Inspection[] = [];
export const roadImages: RoadImage[] = [];

roads.forEach((road, ri) => {
  const hist = road.rhiHistory;
  // 3 inspections: current, ~4 months ago, ~8 months ago
  const picks = [hist[11], hist[7], hist[3]];
  picks.forEach((h, n) => {
    const inspectionId = `INS-${road.id}-${n + 1}`;
    const date = n === 0 ? road.lastInspection : h.date;
    const imgCount = 4;
    inspections.push({ id: inspectionId, roadId: road.id, date, vehicle: VEHICLES[ri % VEHICLES.length], imageCount: imgCount, rhi: h.rhi });
    for (let k = 0; k < imgCount; k++) {
      const t = (k + 0.5) / imgCount;
      const band = rhiBand(h.rhi);
      const url = k % 2 === 0 ? FRAMES[band] : ALL_FRAMES[(ri + k + n) % ALL_FRAMES.length];
      roadImages.push({
        id: `IMG-${road.id}-${n + 1}-${k + 1}`,
        roadId: road.id,
        inspectionId,
        url,
        thumbnailUrl: url,
        capturedAt: `${date}T${String(9 + k).padStart(2, "0")}:${String((ri * 7 + k * 11) % 60).padStart(2, "0")}:00+05:30`,
        location: pointAlong(road.geometry.coordinates, t),
        chainageKm: Math.round(t * road.lengthKm * 100) / 100,
        defectsDetected: Math.max(0, Math.round(road.defectCount / imgCount) - (n === 0 ? 0 : n)),
        rhiAtCapture: h.rhi,
        cameraId: k % 2 === 0 ? "CAM-FRONT" : "CAM-ROAD",
      });
    }
  });
});
