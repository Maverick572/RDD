/**
 * Shared domain types. These mirror the payloads expected from the
 * future FastAPI backend (see README.md → "API contract").
 */

export type LatLng = [number, number]; // [lat, lng]
export type Bounds = [LatLng, LatLng]; // [[south, west], [north, east]]

export type RhiBand = "good" | "fair" | "poor" | "critical";
export type Priority = "low" | "medium" | "high" | "critical";

export interface AdminArea {
  id: string;
  name: string;
  center: LatLng;
  zoom: number;
  bounds: Bounds;
}
export interface StateArea extends AdminArea {
  code: string;
}
export interface DistrictArea extends AdminArea {
  stateId: string;
}
export interface CityArea extends AdminArea {
  districtId: string;
  stateId: string;
  kind: "Municipal Corporation" | "Municipal Council" | "NDMC";
}

export type MaintenanceStatus = "scheduled" | "pending" | "in_progress" | "completed";
export type MaintenanceType =
  | "Pothole patching"
  | "Crack sealing"
  | "Resurfacing"
  | "Lane re-marking"
  | "Micro-surfacing"
  | "Full reconstruction";

export interface RhiHistoryPoint {
  date: string; // ISO date
  rhi: number;
}

export interface Road {
  id: string;
  code: string;
  name: string;
  stateId: string;
  districtId: string;
  cityId: string;
  category: "National Highway" | "State Highway" | "Arterial" | "Sub-arterial" | "Collector";
  surface: "Bituminous" | "Concrete";
  lengthKm: number;
  lanes: number;
  rhi: number; // 0-100 Road Health Index
  priority: Priority;
  lastInspection: string;
  nextInspection: string;
  defectCount: number;
  maintenance: {
    status: MaintenanceStatus;
    type: MaintenanceType;
    scheduledDate: string | null;
    lastCompleted: string | null;
  };
  rhiHistory: RhiHistoryPoint[];
  geometry: GeoJSON.LineString;
}

export type DefectType = "pothole" | "crack" | "faded_marking" | "rutting" | "edge_break";
export type Severity = "low" | "medium" | "high";
export type DefectStatus = "open" | "scheduled" | "repaired";

export interface Defect {
  id: string;
  roadId: string;
  type: DefectType;
  severity: Severity;
  status: DefectStatus;
  location: LatLng;
  chainageKm: number;
  detectedAt: string;
  confidence: number; // 0-1
  areaM2: number;
  imageId: string | null;
  notes: string;
}

export interface RoadImage {
  id: string;
  roadId: string;
  inspectionId: string;
  url: string;
  thumbnailUrl: string;
  capturedAt: string;
  location: LatLng;
  chainageKm: number;
  defectsDetected: number;
  rhiAtCapture: number;
  cameraId: string;
}

export interface Inspection {
  id: string;
  roadId: string;
  date: string;
  vehicle: string;
  imageCount: number;
  rhi: number;
}

export interface MaintenanceTask {
  id: string;
  roadId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: Priority;
  scheduledDate: string;
  completedDate: string | null;
  contractor: string;
  estimatedCostLakh: number;
  chainageFrom: number;
  chainageTo: number;
  notes: string;
}

export interface MediaItem {
  id: string;
  fileName: string;
  kind: "image" | "video";
  sizeMb: number;
  uploadedAt: string;
  roadId: string | null;
  status: "uploaded" | "processing" | "analysed" | "failed";
}

export interface AnalysisDetection {
  type: DefectType;
  severity: Severity;
  confidence: number;
  bbox: [number, number, number, number]; // x, y, w, h in %
  frame?: number;
}

export interface AnalysisResult {
  id: string;
  mediaId: string;
  status: "queued" | "running" | "done";
  progress: number; // 0-100
  model: string;
  startedAt: string;
  finishedAt: string | null;
  estimatedRhi: number | null;
  detections: AnalysisDetection[];
}

export interface AnalyticsSummary {
  totalRoads: number;
  totalLengthKm: number;
  avgRhi: number;
  openDefects: number;
  criticalRoads: number;
  pendingMaintenance: number;
  rhiDistribution: { band: RhiBand; count: number }[];
  defectsByType: { type: DefectType; count: number }[];
  defectsBySeverity: { severity: Severity; count: number }[];
  maintenanceByStatus: { status: MaintenanceStatus; count: number }[];
  rhiTrend: { month: string; rhi: number }[];
  defectTrend: { month: string; detected: number; repaired: number }[];
}

export interface AreaFilter {
  stateId?: string;
  districtId?: string;
  cityId?: string;
}

/** GeoJSON Feature properties for a road on the map (GET /roads/map). */
export interface RoadFeatureProps {
  id: string;
  code: string;
  name: string;
  rhi: number;
  band: RhiBand;
  priority: Priority;
  defectCount: number;
  cityId: string;
}

export interface BoundaryFeatureProps {
  id: string;
  name: string;
  level: "state" | "district" | "city";
  roadCount: number;
  avgRhi: number;
}
