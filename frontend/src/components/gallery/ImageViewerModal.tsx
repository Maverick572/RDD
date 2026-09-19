import React, { useEffect, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatDate, rhiBand, RHI_HEX } from "@/lib/rhi";
import type { Road, RoadImage } from "@/types";

interface ImageViewerModalProps {
  image: RoadImage | null;
  allImages: RoadImage[];
  road?: Road;
  onClose: () => void;
  onSelectImage: (img: RoadImage) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  image,
  allImages,
  road,
  onClose,
  onSelectImage,
}) => {
  const [showAiBoxes, setShowAiBoxes] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  const currentIndex = image ? allImages.findIndex((i) => i.id === image.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allImages.length - 1 && currentIndex !== -1;

  const handlePrev = () => {
    if (hasPrev) onSelectImage(allImages[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onSelectImage(allImages[currentIndex + 1]);
  };

  // Keyboard navigation & Escape key handler
  useEffect(() => {
    if (!image) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        if (hasPrev) onSelectImage(allImages[currentIndex - 1]);
      } else if (e.key === "ArrowRight") {
        if (hasNext) onSelectImage(allImages[currentIndex + 1]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [image, currentIndex, hasPrev, hasNext, allImages, onClose, onSelectImage]);

  if (!image) return null;

  const band = rhiBand(image.rhiAtCapture);
  const bandColor = RHI_HEX[band];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800/80 px-4 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-white">
                {image.id}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${bandColor}33`, color: bandColor }}
              >
                RHI {image.rhiAtCapture}
              </span>
            </div>

            <span className="text-zinc-600 hidden sm:inline">|</span>
            <div className="text-xs text-zinc-300 hidden sm:block">
              <span className="font-semibold">{road?.code}</span> • {road?.name} (Ch. {image.chainageKm} km)
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Overlay toggle */}
            <button
              type="button"
              onClick={() => setShowAiBoxes((p) => !p)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                showAiBoxes
                  ? "bg-primary/20 border-primary/50 text-primary-foreground"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>AI Detections</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="px-1.5 text-[11px] font-mono text-zinc-400">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white ml-2 cursor-pointer transition-colors"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Frame Viewer Area */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-4 select-none">
          {/* Previous image button */}
          {hasPrev && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-zinc-900/80 p-2 text-white shadow-lg backdrop-blur-xs hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Previous Frame (Left Arrow)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image Container with Zoom */}
          <div
            className="relative transition-transform duration-150 ease-out"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              src={image.url}
              alt="Road Inspection Frame"
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl"
            />

            {/* AI Bounding Box Overlays */}
            {showAiBoxes && (
              <>
                <div
                  className="absolute border-2 border-rose-500 bg-rose-500/25 rounded"
                  style={{
                    top: "35%",
                    left: "40%",
                    width: "28%",
                    height: "22%",
                  }}
                >
                  <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase shadow-xs">
                    <span>Pothole</span>
                    <span className="opacity-80">92%</span>
                  </div>
                </div>

                <div
                  className="absolute border-2 border-amber-500 bg-amber-500/20 rounded"
                  style={{
                    top: "60%",
                    left: "20%",
                    width: "45%",
                    height: "15%",
                  }}
                >
                  <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase shadow-xs">
                    <span>Crack / Distress</span>
                    <span className="opacity-80">86%</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Next image button */}
          {hasNext && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-zinc-900/80 p-2 text-white shadow-lg backdrop-blur-xs hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Next Frame (Right Arrow)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Footer Metadata */}
        <div className="flex h-14 items-center justify-between border-t border-zinc-800 bg-zinc-900/90 px-6 text-xs text-zinc-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-zinc-500" />
              <span>Camera Sensor: <strong className="text-zinc-200">{image.cameraId}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-zinc-500" />
              <span>Captured: <strong className="text-zinc-200">{formatDate(image.capturedAt)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 hidden md:flex">
              <MapPin className="h-4 w-4 text-zinc-500" />
              <span>Location: <strong className="text-zinc-200">[{image.location[0].toFixed(4)}, {image.location[1].toFixed(4)}]</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Frame <strong className="text-white">{currentIndex + 1}</strong> of {allImages.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
