"""Explainable visual severity scoring for individual road-defect detections."""

from __future__ import annotations

from dataclasses import dataclass, field
from math import isfinite, sqrt
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np
from PIL import Image


ALGORITHM_VERSION = "visual-severity-v1"
DEFAULT_CLASS_WEIGHT = 0.40
DEFAULT_COMPONENT_WEIGHTS = {
	"confidence": 0.35,
	"footprint": 0.20,
	"shape": 0.15,
	"visual": 0.30,
}
DEFAULT_CLASS_WEIGHTS = {
	"D40": 1.00,
	"D10": 0.85,
	"D00": 0.50,
	"D20": 0.45,
	"D44": 0.35,
}
CLASS_ALIASES = {
	"pothole": "D40",
	"potholes": "D40",
	"alligator crack": "D10",
	"alligator cracking": "D10",
	"longitudinal crack": "D00",
	"longitudinal cracking": "D00",
	"transverse crack": "D20",
	"transverse cracking": "D20",
	"faded marking": "D44",
	"faded lane marking": "D44",
	"faded lane markings": "D44",
}
CRACK_CLASSES = {"D00", "D10", "D20"}


@dataclass(frozen=True)
class SeverityConfig:
	"""Tunable values for the visual severity model."""

	class_weights: Mapping[str, float] = field(
		default_factory=lambda: dict(DEFAULT_CLASS_WEIGHTS)
	)
	unknown_class_weight: float = DEFAULT_CLASS_WEIGHT
	component_weights: Mapping[str, float] = field(
		default_factory=lambda: dict(DEFAULT_COMPONENT_WEIGHTS)
	)
	footprint_saturation_ratio: float = 0.25
	minimum_crop_pixels: int = 25
	confidence_power: float = 1.0
	level_thresholds: Mapping[str, float] = field(
		default_factory=lambda: {
			"moderate": 25.0,
			"high": 50.0,
			"critical": 75.0,
		}
	)


def score_detection(
	image: str | Path | Image.Image | np.ndarray | None,
	detection: Mapping[str, Any],
	config: SeverityConfig | None = None,
) -> dict[str, Any]:
	"""Score one YOLO-style detection and return an explainable result.

	The score is a visual estimate in the range 0-100. It is intended for
	ranking and review, not for inferring crack depth or structural failure.
	"""

	settings = config or SeverityConfig()
	warnings: list[str] = []
	reasons: list[str] = []
	if not isinstance(detection, Mapping):
		warnings.append("Invalid detection mapping; default values used")
		detection = {}
	original_class = _read_class_name(detection)
	canonical_class = _canonical_class(original_class)
	class_weight = _unit_value(
		_mapping_value(settings.class_weights, canonical_class, settings.unknown_class_weight)
	)
	if canonical_class not in settings.class_weights:
		warnings.append(f"Unknown defect class '{original_class}'; fallback class weight used")

	confidence = _read_confidence(detection, warnings)
	image_array = _load_image(image, warnings)
	image_width, image_height = _image_dimensions(image_array, detection, warnings)
	bbox = _normalize_bbox(
		detection.get("bbox"), image_width, image_height, warnings
	)

	confidence_component = _unit_value(confidence ** max(settings.confidence_power, 0.0))
	footprint_component = _footprint_component(
		bbox, image_width, image_height, settings.footprint_saturation_ratio
	)
	shape_component = _shape_component(bbox, canonical_class)
	visual_component = _visual_component(
		image_array, bbox, settings.minimum_crop_pixels, warnings
	)

	components = {
		"class_weight": round(class_weight, 4),
		"confidence": round(confidence_component, 4),
		"footprint": round(footprint_component, 4),
		"shape": round(shape_component, 4),
		"visual": round(visual_component, 4),
	}
	evidence = sum(
		components[name] * _unit_value(float(settings.component_weights.get(name, 0.0)))
		for name in DEFAULT_COMPONENT_WEIGHTS
	)
	score = _score_value(class_weight * evidence * 100.0)
	level = _severity_level(score, settings.level_thresholds)

	reasons.append(f"{canonical_class} class prior contributes {class_weight:.2f}")
	if confidence_component >= 0.75:
		reasons.append("High detector confidence supports the estimate")
	elif confidence_component < 0.40:
		reasons.append("Low detector confidence reduces the estimate")
	if footprint_component >= 0.50:
		reasons.append("The detection occupies a substantial image footprint")
	if canonical_class in CRACK_CLASSES and shape_component >= 0.50:
		reasons.append("Elongated geometry is consistent with a crack-like defect")
	if visual_component >= 0.65:
		reasons.append("The crop contains strong luminance or edge variation")
	if image_array is None:
		reasons.append("Pixel evidence was unavailable; visual evidence used a neutral fallback")
	reasons.extend(f"Fallback applied: {warning}" for warning in warnings)

	return {
		"severity_score": round(score, 2),
		"severity_level": level,
		"class_name": original_class,
		"canonical_class": canonical_class,
		"confidence": round(confidence, 4),
		"bbox": [round(value, 2) for value in bbox],
		"components": components,
		"reasons": reasons,
		"warnings": warnings,
		"algorithm_version": ALGORITHM_VERSION,
	}


def _read_class_name(detection: Mapping[str, Any]) -> str:
	value = detection.get("class", detection.get("class_name", "unknown"))
	return str(value).strip() or "unknown"


def _canonical_class(class_name: str) -> str:
	normalized = class_name.strip().lower()
	return CLASS_ALIASES.get(normalized, class_name.strip().upper())


def _read_confidence(detection: Mapping[str, Any], warnings: list[str]) -> float:
	value = detection.get("confidence", detection.get("conf", 0.0))
	try:
		confidence = float(value)
	except (TypeError, ValueError):
		warnings.append("Invalid confidence; zero used")
		return 0.0
	if not isfinite(confidence):
		warnings.append("Non-finite confidence; zero used")
		return 0.0
	bounded = _unit_value(confidence)
	if bounded != confidence:
		warnings.append("Confidence was clamped to the range 0-1")
	return bounded


def _load_image(
	image: str | Path | Image.Image | np.ndarray | None,
	warnings: list[str],
) -> np.ndarray | None:
	if image is None:
		warnings.append("Image pixels unavailable")
		return None
	try:
		if isinstance(image, (str, Path)):
			with Image.open(image) as loaded:
				array = np.asarray(loaded.convert("RGB"))
		elif isinstance(image, Image.Image):
			array = np.asarray(image.convert("RGB"))
		else:
			array = np.asarray(image)
		if array.ndim == 2:
			array = np.repeat(array[:, :, None], 3, axis=2)
		if array.ndim != 3 or array.shape[2] not in {1, 3, 4}:
			raise ValueError("expected a 2D grayscale or 3D color image")
		if array.shape[2] == 1:
			array = np.repeat(array, 3, axis=2)
		if array.shape[2] == 4:
			array = array[:, :, :3]
		array = array.astype(np.float32, copy=False)
		if array.size and float(np.nanmax(array)) <= 1.0:
			array = array * 255.0
		return np.nan_to_num(array, nan=0.0, posinf=255.0, neginf=0.0)
	except (OSError, TypeError, ValueError):
		warnings.append("Image could not be loaded; pixel evidence unavailable")
		return None


def _image_dimensions(
	image_array: np.ndarray | None,
	detection: Mapping[str, Any],
	warnings: list[str],
) -> tuple[int, int]:
	if image_array is not None:
		return int(image_array.shape[1]), int(image_array.shape[0])
	if "image_width" not in detection or "image_height" not in detection:
		warnings.append("Image dimensions unavailable; box footprint is limited")
		return 0, 0
	try:
		width_value = float(detection["image_width"])
		height_value = float(detection["image_height"])
		if not isfinite(width_value) or not isfinite(height_value):
			raise ValueError
		width = max(1, int(width_value))
		height = max(1, int(height_value))
	except (OverflowError, TypeError, ValueError):
		warnings.append("Invalid image dimensions; box footprint is limited")
		return 0, 0
	return width, height


def _normalize_bbox(
	raw_bbox: Any,
	image_width: int,
	image_height: int,
	warnings: list[str],
) -> tuple[float, float, float, float]:
	if not isinstance(raw_bbox, (Sequence, np.ndarray)) or isinstance(raw_bbox, (str, bytes)):
		warnings.append("Invalid bounding box; zero box used")
		return 0.0, 0.0, 0.0, 0.0
	try:
		values = [float(value) for value in raw_bbox]
		if len(values) != 4 or not all(isfinite(value) for value in values):
			raise ValueError
	except (TypeError, ValueError):
		warnings.append("Invalid bounding box; zero box used")
		return 0.0, 0.0, 0.0, 0.0
	x1, y1, x2, y2 = values
	if x2 < x1 or y2 < y1:
		warnings.append("Reversed bounding box coordinates were reordered")
		x1, x2 = sorted((x1, x2))
		y1, y2 = sorted((y1, y2))
	clipped = (
		max(0.0, min(x1, image_width)),
		max(0.0, min(y1, image_height)),
		max(0.0, min(x2, image_width)),
		max(0.0, min(y2, image_height)),
	)
	if clipped != (x1, y1, x2, y2):
		warnings.append("Bounding box was clipped to image bounds")
	if clipped[2] <= clipped[0] or clipped[3] <= clipped[1]:
		warnings.append("Bounding box has zero area")
	return clipped


def _footprint_component(
	bbox: tuple[float, float, float, float],
	image_width: int,
	image_height: int,
	saturation_ratio: float,
) -> float:
	x1, y1, x2, y2 = bbox
	width_ratio = max(0.0, (x2 - x1) / max(float(image_width), 1.0))
	height_ratio = max(0.0, (y2 - y1) / max(float(image_height), 1.0))
	ratio = width_ratio * height_ratio
	saturation = max(float(saturation_ratio), 1e-9)
	return _unit_value(sqrt(min(ratio / saturation, 1.0)))


def _shape_component(
	bbox: tuple[float, float, float, float], canonical_class: str
) -> float:
	width = max(bbox[2] - bbox[0], 0.0)
	height = max(bbox[3] - bbox[1], 0.0)
	if width == 0.0 or height == 0.0:
		return 0.0
	aspect_ratio = max(width, height) / min(width, height)
	elongation = _unit_value((aspect_ratio - 1.0) / 7.0)
	if canonical_class in CRACK_CLASSES:
		return elongation
	return _unit_value(1.0 / aspect_ratio)


def _visual_component(
	image_array: np.ndarray | None,
	bbox: tuple[float, float, float, float],
	minimum_crop_pixels: int,
	warnings: list[str],
) -> float:
	if image_array is None:
		return 0.0
	x1, y1, x2, y2 = (int(round(value)) for value in bbox)
	crop = image_array[y1:y2, x1:x2]
	if crop.shape[0] * crop.shape[1] < max(minimum_crop_pixels, 1):
		warnings.append("Bounding-box crop is too small; neutral visual evidence used")
		return 0.5
	grayscale = (
		crop[:, :, 0] * 0.299
		+ crop[:, :, 1] * 0.587
		+ crop[:, :, 2] * 0.114
	)
	contrast = _unit_value(float(np.std(grayscale)) / 64.0)
	horizontal_edges = np.abs(np.diff(grayscale, axis=1)) if grayscale.shape[1] > 1 else np.empty(0)
	vertical_edges = np.abs(np.diff(grayscale, axis=0)) if grayscale.shape[0] > 1 else np.empty(0)
	edge_values = np.concatenate((horizontal_edges.ravel(), vertical_edges.ravel()))
	edge_density = _unit_value(float(np.mean(edge_values > 20.0)) if edge_values.size else 0.0)
	return _unit_value(0.5 * contrast + 0.5 * edge_density)


def _severity_level(score: float, thresholds: Mapping[str, float]) -> str:
	if score < float(thresholds.get("moderate", 25.0)):
		return "low"
	if score < float(thresholds.get("high", 50.0)):
		return "moderate"
	if score < float(thresholds.get("critical", 75.0)):
		return "high"
	return "critical"


def _mapping_value(mapping: Mapping[str, float], key: str, fallback: float) -> float:
	try:
		value = float(mapping.get(key, fallback))
	except (TypeError, ValueError):
		return fallback
	return value if isfinite(value) else fallback


def _unit_value(value: float) -> float:
	if not isfinite(value):
		return 0.0
	return max(0.0, min(1.0, value))


def _score_value(value: float) -> float:
	if not isfinite(value):
		return 0.0
	return max(0.0, min(100.0, value))


__all__ = ["SeverityConfig", "score_detection"]
