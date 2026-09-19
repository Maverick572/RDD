import type { AnalysisResult, MediaItem } from "@/types";

export const mediaItems: MediaItem[] = [
  { id: "MED-0031", fileName: "karve_rd_ch0200_0900.mp4", kind: "video", sizeMb: 412.6, uploadedAt: "2026-09-06T10:12:00+05:30", roadId: "R-PMC-003", status: "analysed" },
  { id: "MED-0030", fileName: "weh_andheri_frame_0417.jpg", kind: "image", sizeMb: 3.2, uploadedAt: "2026-09-05T16:40:00+05:30", roadId: "R-BMC-001", status: "analysed" },
  { id: "MED-0029", fileName: "orr_marathahalli_run2.mp4", kind: "video", sizeMb: 388.1, uploadedAt: "2026-09-04T09:05:00+05:30", roadId: "R-BBMP-001", status: "analysed" },
];

export const analysisResults: AnalysisResult[] = [
  {
    id: "AN-0031",
    mediaId: "MED-0031",
    status: "done",
    progress: 100,
    model: "roadsense-yolov8m-v2.3",
    startedAt: "2026-09-06T10:13:00+05:30",
    finishedAt: "2026-09-06T10:19:00+05:30",
    estimatedRhi: 24,
    detections: [
      { type: "pothole", severity: "high", confidence: 0.94, bbox: [38, 62, 22, 16], frame: 120 },
      { type: "crack", severity: "medium", confidence: 0.87, bbox: [55, 48, 30, 20], frame: 340 },
      { type: "pothole", severity: "medium", confidence: 0.81, bbox: [20, 70, 14, 10], frame: 512 },
      { type: "faded_marking", severity: "low", confidence: 0.79, bbox: [10, 55, 60, 8], frame: 760 },
    ],
  },
];

/** Mock detections returned for newly uploaded files (cycled). */
export const sampleDetections: AnalysisResult["detections"][] = [
  [
    { type: "pothole", severity: "high", confidence: 0.93, bbox: [36, 60, 24, 18] },
    { type: "crack", severity: "medium", confidence: 0.86, bbox: [58, 45, 28, 22] },
    { type: "faded_marking", severity: "low", confidence: 0.77, bbox: [8, 52, 62, 9] },
  ],
  [
    { type: "crack", severity: "high", confidence: 0.91, bbox: [40, 40, 35, 30] },
    { type: "crack", severity: "medium", confidence: 0.84, bbox: [15, 60, 20, 18] },
    { type: "rutting", severity: "medium", confidence: 0.72, bbox: [30, 70, 40, 12] },
  ],
  [
    { type: "faded_marking", severity: "medium", confidence: 0.88, bbox: [5, 50, 70, 8] },
    { type: "edge_break", severity: "low", confidence: 0.74, bbox: [0, 65, 12, 20] },
  ],
];
