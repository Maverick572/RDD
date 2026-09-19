import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  FileVideo,
  HardDrive,
  ImageIcon,
  Layers,
  Percent,
  Play,
  RotateCw,
  Sparkles,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DEFECT_LABEL, formatDate, rhiBand, RHI_HEX, SEVERITY_LABEL } from "@/lib/rhi";
import { mediaService } from "@/services/media.service";
import { roadsService } from "@/services/roads.service";
import type { AnalysisResult, MediaItem, Road } from "@/types";
import imgPothole from "@/assets/inspection-pothole.jpg";
import imgCracks from "@/assets/inspection-cracks.jpg";
import imgMarkings from "@/assets/inspection-markings.jpg";
import imgGood from "@/assets/inspection-good.jpg";

export const Route = createFileRoute("/media")({
  component: MediaAnalysisPage,
});

function MediaAnalysisPage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [selectedRoadId, setSelectedRoadId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisResult | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    roadsService.getRoads().then((r) => {
      setRoads(r);
      if (r.length > 0) setSelectedRoadId(r[0].id);
    });
    mediaService.getMediaItems().then(setMediaList);
    mediaService.getAnalysisResult("AN-0031").then(setActiveAnalysis);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadAndRun = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setIsProcessing(true);
    setProcessingProgress(15);

    try {
      const isVideo = selectedFile.type.includes("video") || selectedFile.name.endsWith(".mp4");
      const sizeMb = Math.round((selectedFile.size / (1024 * 1024)) * 10) / 10 || 45.2;

      // Simulate upload
      const uploadedMedia = await mediaService.uploadMedia({
        fileName: selectedFile.name,
        sizeMb,
        kind: isVideo ? "video" : "image",
        roadId: selectedRoadId || null,
      });

      setMediaList(await mediaService.getMediaItems());
      setIsUploading(false);

      // Simulate step-by-step progress
      for (let p = 25; p <= 90; p += 20) {
        setProcessingProgress(p);
        await new Promise((r) => setTimeout(r, 450));
      }

      const result = await mediaService.runAnalysis(uploadedMedia.id);
      setProcessingProgress(100);
      setActiveAnalysis(result);
      setMediaList(await mediaService.getMediaItems());
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewAnalysis = async (mediaId: string) => {
    const result = await mediaService.getAnalysisResult(mediaId);
    if (result) {
      setActiveAnalysis(result);
    } else {
      // Run on demand if not yet analysed
      setIsProcessing(true);
      setProcessingProgress(40);
      const res = await mediaService.runAnalysis(mediaId);
      setProcessingProgress(100);
      setActiveAnalysis(res);
      setMediaList(await mediaService.getMediaItems());
      setIsProcessing(false);
    }
  };

  const roadMap = new Map(roads.map((r) => [r.id, r]));

  return (
    <AppShell
      title="Computer Vision & AI Inference Engine"
      subtitle="Automated pavement distress segmentation via YOLOv8m-RDD model with bounding box localisation"
    >
      <div className="space-y-5 p-4 lg:p-6">
        {/* Upload & Inference Trigger Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Upload Dropzone (2 cols) */}
          <div className="panel p-5 lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Upload Dashcam / High-Res Road Footage for AI Inference
                  </h2>
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  YOLOv8m-RDD v2.3
                </span>
              </div>

              {/* Target Corridor selection */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="label-caps">Associate with Corridor:</label>
                <select
                  value={selectedRoadId}
                  onChange={(e) => setSelectedRoadId(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary cursor-pointer w-72"
                >
                  {roads.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name} (RHI: {r.rhi})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : selectedFile
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-border hover:border-primary/50 bg-background/50"
                }`}
              >
                <input
                  type="file"
                  id="media-file-input"
                  accept="video/mp4,video/avi,image/jpeg,image/png"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 mx-auto">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="font-semibold text-sm text-foreground">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready for neural inference
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-rose-600 hover:underline font-medium"
                    >
                      Choose another file
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="media-file-input"
                    className="cursor-pointer space-y-2"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="font-semibold text-primary hover:underline text-sm">
                        Click to upload footage
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}or drag & drop here
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Supports MP4, AVI, JPG, PNG from dashcams, LiDAR or drone sweeps (Max 500MB)
                    </p>
                  </label>
                )}
              </div>
            </div>

            {/* Inference Progress or Trigger Button */}
            <div className="mt-4 pt-3 border-t border-border">
              {isProcessing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" />
                      Running Neural Distress Extraction...
                    </span>
                    <span className="font-mono text-primary font-bold">
                      {processingProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Model: YOLOv8m-RDD • Generating bounding boxes & RHI impact estimations...
                  </p>
                </div>
              ) : (
                <button
                  disabled={!selectedFile || isProcessing}
                  onClick={handleUploadAndRun}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                  <span>Execute Neural Analysis & Distress Extraction</span>
                </button>
              )}
            </div>
          </div>

          {/* Model Specification Card (1 col) */}
          <div className="panel p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-border pb-2.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Model Specifications
                </h3>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded bg-muted/40 p-2 border border-border/50">
                  <span className="text-muted-foreground">Architecture</span>
                  <span className="font-mono font-bold text-foreground">
                    YOLOv8m-RDD
                  </span>
                </div>

                <div className="flex items-center justify-between rounded bg-muted/40 p-2 border border-border/50">
                  <span className="text-muted-foreground">Classes Detected</span>
                  <span className="font-medium text-foreground">
                    Potholes, Cracks, Markings, Rutting
                  </span>
                </div>

                <div className="flex items-center justify-between rounded bg-muted/40 p-2 border border-border/50">
                  <span className="text-muted-foreground">Validation mAP@50</span>
                  <span className="font-mono font-bold text-emerald-600">
                    89.4%
                  </span>
                </div>

                <div className="flex items-center justify-between rounded bg-muted/40 p-2 border border-border/50">
                  <span className="text-muted-foreground">Inference Speed</span>
                  <span className="font-mono font-medium text-foreground">
                    18.2 ms / frame
                  </span>
                </div>

                <div className="flex items-center justify-between rounded bg-muted/40 p-2 border border-border/50">
                  <span className="text-muted-foreground">Backend Target</span>
                  <span className="font-mono text-[11px] text-primary">
                    POST /analysis/run
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground">
              Processed media seamlessly updates RHI degradation curves and issues auto work recommendations.
            </div>
          </div>
        </div>

        {/* AI Inference Output & Bounding Box Inspection Frame */}
        {activeAnalysis && (
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                    {activeAnalysis.id}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-500/30">
                    Inference Complete
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-bold text-foreground">
                  Distress Detections ({activeAnalysis.detections.length} objects identified)
                </h3>
              </div>

              {activeAnalysis.estimatedRhi !== null && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 border border-border">
                  <span className="text-xs text-muted-foreground font-medium">
                    Calculated Corridor Health:
                  </span>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{
                      color: RHI_HEX[rhiBand(activeAnalysis.estimatedRhi)],
                    }}
                  >
                    RHI {activeAnalysis.estimatedRhi} / 100
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Frame Viewer with Bounding Boxes */}
              <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-16/9 flex items-center justify-center">
                <img
                  src={imgPothole}
                  alt="Inference Frame"
                  className="h-full w-full object-cover"
                />

                {/* Render bounding boxes */}
                {activeAnalysis.detections.map((det, idx) => {
                  const [x, y, w, h] = det.bbox;
                  const isHigh = det.severity === "high";
                  const boxColor = isHigh ? "#e11d48" : "#f59e0b";

                  return (
                    <div
                      key={idx}
                      className="absolute border-2 rounded shadow-md transition-all duration-200 hover:scale-105"
                      style={{
                        top: `${y}%`,
                        left: `${x}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                        borderColor: boxColor,
                        backgroundColor: `${boxColor}22`,
                      }}
                    >
                      <div
                        className="absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white uppercase shadow-xs flex items-center gap-1"
                        style={{ backgroundColor: boxColor }}
                      >
                        <span>{DEFECT_LABEL[det.type] || det.type}</span>
                        <span>({Math.round(det.confidence * 100)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detections Breakdown Table */}
              <div className="space-y-3">
                <div className="label-caps">Neural Detection Log</div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Severity</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Bounding Box [x,y,w,h]</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {activeAnalysis.detections.map((det, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium text-foreground">
                            {DEFECT_LABEL[det.type] || det.type}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                det.severity === "high"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {det.severity}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-foreground">
                            {Math.round(det.confidence * 100)}%
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                            [{det.bbox.join(", ")}]%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Model: {activeAnalysis.model}
                  </span>
                  <Link
                    to="/maintenance"
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Schedule Repair for Detected Distress →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Media History Log */}
        <div className="panel p-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Footage Registry & Inference History
              </h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {mediaList.length} files
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Media File</th>
                  <th className="px-3 py-2">Format</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Corridor</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Inference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mediaList.map((m) => {
                  const road = m.roadId ? roadMap.get(m.roadId) : undefined;
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-medium text-foreground">
                        {m.fileName}
                      </td>
                      <td className="px-3 py-2.5 uppercase text-muted-foreground">
                        {m.kind}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {m.sizeMb} MB
                      </td>
                      <td className="px-3 py-2.5">
                        {road ? (
                          <span className="font-semibold text-foreground">
                            {road.code} - {road.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatDate(m.uploadedAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            m.status === "analysed"
                              ? "bg-emerald-50 text-emerald-700"
                              : m.status === "processing"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleViewAnalysis(m.id)}
                          className="rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          View BBoxes →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
