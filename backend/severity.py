from math import sqrt
import cv2
import numpy as np


CLASS_WEIGHTS = {
    "D40": 1.00,   # Pothole
    "D10": 0.85,
    "D00": 0.50,
    "D20": 0.45,
    "D44": 0.35,
}

CRACK_CLASSES = {"D00", "D10", "D20"}


def calculate_severity(
    image_path: str,
    detection: dict,
    image_width: int,
    image_height: int,
):
    """
    Calculate visual severity for one YOLO detection.

    Returns:
        {
            "severity_score": float,
            "severity": str
        }
    """

    # --------------------------------------------------
    # 1. Detection class
    # --------------------------------------------------

    defect_class = detection["class"].strip()

    # Support normal class names as well
    aliases = {
        "pothole": "D40",
        "potholes": "D40",
        "alligator crack": "D10",
        "longitudinal crack": "D00",
        "transverse crack": "D20",
        "faded marking": "D44",
    }

    canonical_class = aliases.get(
        defect_class.lower(),
        defect_class.upper()
    )

    class_weight = CLASS_WEIGHTS.get(
        canonical_class,
        0.40
    )

    # --------------------------------------------------
    # 2. Confidence
    # --------------------------------------------------

    confidence = float(detection["confidence"])
    confidence = max(0.0, min(1.0, confidence))

    # --------------------------------------------------
    # 3. Bounding box footprint
    # --------------------------------------------------

    x1, y1, x2, y2 = detection["bbox"]

    box_width = max(x2 - x1, 0)
    box_height = max(y2 - y1, 0)

    width_ratio = box_width / max(image_width, 1)
    height_ratio = box_height / max(image_height, 1)

    area_ratio = width_ratio * height_ratio

    # 25% of image = maximum footprint contribution
    footprint = sqrt(
        min(area_ratio / 0.25, 1.0)
    )

    # --------------------------------------------------
    # 4. Shape
    # --------------------------------------------------

    if box_width == 0 or box_height == 0:
        shape = 0.0
    else:
        aspect_ratio = max(box_width, box_height) / min(
            box_width,
            box_height
        )

        elongation = max(
            0.0,
            min(
                (aspect_ratio - 1.0) / 7.0,
                1.0
            )
        )

        if canonical_class in CRACK_CLASSES:
            # Elongated shape is more characteristic of cracks
            shape = elongation
        else:
            # Compact shapes are more characteristic of potholes
            shape = max(
                0.0,
                min(1.0 / aspect_ratio, 1.0)
            )

    # --------------------------------------------------
    # 5. Visual features
    # --------------------------------------------------

    image = cv2.imread(image_path)

    if image is None:
        visual = 0.0
    else:
        x1 = max(0, min(int(x1), image_width))
        y1 = max(0, min(int(y1), image_height))
        x2 = max(0, min(int(x2), image_width))
        y2 = max(0, min(int(y2), image_height))

        crop = image[y1:y2, x1:x2]

        if crop.size == 0:
            visual = 0.5
        else:
            gray = cv2.cvtColor(
                crop,
                cv2.COLOR_BGR2GRAY
            )

            # Contrast
            contrast = min(
                float(np.std(gray)) / 64.0,
                1.0
            )

            # Edge density
            horizontal = (
                np.abs(np.diff(gray.astype(float), axis=1))
                if gray.shape[1] > 1
                else np.array([])
            )

            vertical = (
                np.abs(np.diff(gray.astype(float), axis=0))
                if gray.shape[0] > 1
                else np.array([])
            )

            edges = np.concatenate([
                horizontal.flatten(),
                vertical.flatten()
            ])

            edge_density = (
                float(np.mean(edges > 20))
                if edges.size
                else 0.0
            )

            edge_density = max(
                0.0,
                min(edge_density, 1.0)
            )

            visual = (
                0.5 * contrast +
                0.5 * edge_density
            )

    # --------------------------------------------------
    # 6. Weighted score
    # --------------------------------------------------

    evidence = (
        confidence * 0.35 +
        footprint * 0.20 +
        shape * 0.15 +
        visual * 0.30
    )

    score = class_weight * evidence * 100

    score = max(
        0.0,
        min(100.0, score)
    )

    # --------------------------------------------------
    # 7. Severity level
    # --------------------------------------------------

    if score < 25:
        severity = "low"
    elif score < 50:
        severity = "moderate"
    elif score < 75:
        severity = "high"
    else:
        severity = "critical"

    return {
        "severity_score": round(score, 2),
        "severity": severity,
    }