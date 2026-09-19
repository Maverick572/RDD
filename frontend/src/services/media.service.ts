import {
  analysisResults as initialAnalysis,
  mediaItems as initialMedia,
  sampleDetections,
} from "@/mock-data/media";
import type { AnalysisResult, MediaItem } from "@/types";

let currentMedia: MediaItem[] = [...initialMedia];
let currentAnalysis: AnalysisResult[] = [...initialAnalysis];

export const mediaService = {
  async getMediaItems(): Promise<MediaItem[]> {
    return [...currentMedia];
  },

  async getMediaItemById(id: string): Promise<MediaItem | undefined> {
    return currentMedia.find((m) => m.id === id);
  },

  async uploadMedia(params: {
    fileName: string;
    sizeMb: number;
    kind: "image" | "video";
    roadId?: string | null;
  }): Promise<MediaItem> {
    const nextId = `MED-00${32 + currentMedia.length}`;
    const newItem: MediaItem = {
      id: nextId,
      fileName: params.fileName,
      sizeMb: params.sizeMb,
      kind: params.kind,
      roadId: params.roadId || null,
      uploadedAt: new Date().toISOString(),
      status: "uploaded",
    };
    currentMedia = [newItem, ...currentMedia];
    return newItem;
  },

  async runAnalysis(mediaId: string): Promise<AnalysisResult> {
    const media = currentMedia.find((m) => m.id === mediaId);
    if (!media) {
      throw new Error(`Media item ${mediaId} not found`);
    }

    media.status = "processing";

    const analysisId = `AN-00${32 + currentAnalysis.length}`;
    const detections =
      sampleDetections[currentAnalysis.length % sampleDetections.length];

    const newResult: AnalysisResult = {
      id: analysisId,
      mediaId,
      status: "done",
      progress: 100,
      model: "roadsense-yolov8m-v2.3",
      startedAt: new Date().toISOString(),
      finishedAt: new Date(Date.now() + 3500).toISOString(),
      estimatedRhi: Math.round(35 + Math.random() * 45),
      detections,
    };

    media.status = "analysed";
    currentAnalysis = [newResult, ...currentAnalysis];
    return newResult;
  },

  async getAnalysisResult(idOrMediaId: string): Promise<AnalysisResult | undefined> {
    return currentAnalysis.find(
      (a) => a.id === idOrMediaId || a.mediaId === idOrMediaId
    );
  },

  async getAnalysisResults(): Promise<AnalysisResult[]> {
    return [...currentAnalysis];
  },
};
