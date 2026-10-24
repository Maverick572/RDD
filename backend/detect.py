from fastapi import APIRouter, UploadFile, File, Query
import logging
from pathlib import Path

from backend.storage import save_upload
from backend.cleanup import cleanup_directories
from backend.metadata import extract_gps
from backend.inference import detect_road_damage
from backend.find_nearest import find_nearest_road
from backend.supabase_storage import upload_image
from backend.severity import calculate_severity
from backend.calculate_rhi import calculate_rhi
from backend.check_duplicate import is_duplicate_defect

import psycopg2
import os

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/detect")
async def detect(
    file: UploadFile = File(...),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
):
    return await process_detection(file, lat, lng)


async def process_detection(
    file: UploadFile,
    lat: float | None,
    lng: float | None,
    vibration_rms: float | None = None,
    iot_capture: bool = False,
):
    """Run shared defect processing, with IoT-only image and severity handling."""
    try:
        return await _detect_impl(file, lat, lng, vibration_rms, iot_capture)
    finally:
        try:
            cleanup_directories()
        except OSError:
            logger.exception("Failed to clean uploads and outputs after detection")


async def _detect_impl(
    file: UploadFile,
    lat: float | None,
    lng: float | None,
    vibration_rms: float | None = None,
    iot_capture: bool = False,
):
    # 1. Save uploaded image temporarily
    image_path = await save_upload(file)

    # 2. Try extracting GPS from image
    location = extract_gps(image_path)

    if not location:
        if lat is not None and lng is not None:
            location = {
                "latitude": lat,
                "longitude": lng,
            }
        elif not iot_capture:
            return {"error": "Location not found"}

    # IoT images run inference even without GPS so the annotated image is still
    # available for review; normal uploads retain the earlier GPS-first flow.
    detection = detect_road_damage(image_path)
    inference_image = (
        Path(detection["image"]).read_bytes()
        if iot_capture
        else None
    )

    def pipeline_error(message: str) -> dict:
        result = {"error": message}
        if inference_image is not None:
            result["_inference_image_bytes"] = inference_image
        return result

    # 4. Stop if no defects were found
    if not detection["detections"]:
        return pipeline_error("Defects not found")

    if location is None:
        return pipeline_error("Location not found")

    latitude = location["latitude"]
    longitude = location["longitude"]

    # 5. Find nearest road
    road = find_nearest_road(latitude, longitude)

    if not road:
        return pipeline_error("Location not found")

    # 6. Check for duplicate defects before uploading or writing anything
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        for det in detection["detections"]:
            if is_duplicate_defect(
                road["id"],
                det["class"],
                latitude,
                longitude,
                cur,
            ):
                return pipeline_error("Complaint already registered")

        # 7. Upload ONLY annotated image to Supabase Storage
        try:
            annotated_image_url = upload_image(detection["image"])
        except Exception:
            return pipeline_error("Image upload failed")

        # 8. Insert detected defects
        inserted_defects = []

        for det in detection["detections"]:

            # Calculate visual severity score
            severity_result = calculate_severity(
                image_path=image_path,
                detection=det,
                image_width=detection["image_width"],
                image_height=detection["image_height"],
            )

            severity = severity_result["severity_score"]
            if vibration_rms is not None:
                # For IoT captures only: 20% vibration + 80% visual severity.
                # Normalize RMS acceleration to [0, 1] at 2 m/s^2; clamp above it.
                vibration_score = min(max(vibration_rms / 2.0, 0.0), 1.0) * 100
                severity = round(0.8 * severity + 0.2 * vibration_score, 2)
                if severity < 25:
                    severity_result["severity"] = "low"
                elif severity < 50:
                    severity_result["severity"] = "moderate"
                elif severity < 75:
                    severity_result["severity"] = "high"
                else:
                    severity_result["severity"] = "critical"

            cur.execute(
                """
                INSERT INTO defects (
                    road_id,
                    type,
                    confidence,
                    severity,
                    location,
                    image_url,
                    timestamp
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    ST_SetSRID(
                        ST_MakePoint(%s, %s),
                        4326
                    )::geography,
                    %s,
                    NOW()
                )
                RETURNING id;
                """,
                (
                    road["id"],
                    det["class"],
                    det["confidence"],
                    severity,
                    longitude,
                    latitude,
                    annotated_image_url,
                ),
            )

            defect_id = cur.fetchone()[0]

            inserted_defect = {
                "id": defect_id,
                "type": det["class"],
                "confidence": det["confidence"],
                "severity": severity,
            }
            if vibration_rms is not None:
                inserted_defect["severity_level"] = severity_result["severity"]
                inserted_defect["visual_severity"] = severity_result["severity_score"]
            inserted_defects.append(inserted_defect)

        # 9. Recalculate RHI from all defects on this road in this transaction
        road["rhi"] = calculate_rhi(road["id"], cur)

        # 10. Commit
        conn.commit()

        # 11. Return response
        result = {
            "filename": file.filename,
            "location": location,
            "road": road,
            "defects": inserted_defects,
            "annotated_image": annotated_image_url,
        }
        if vibration_rms is not None:
            result["imu_dynamic_magnitude_rms"] = vibration_rms
            result["severity_formula"] = (
                "0.8 * visual_severity + 0.2 * "
                "min(max(dynamic_magnitude_rms / 2.0, 0), 1) * 100"
            )
        if inference_image is not None:
            result["_inference_image_bytes"] = inference_image
        return result

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()