from fastapi import APIRouter, UploadFile, File, Query
import logging

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
    try:
        return await _detect_impl(file, lat, lng)
    finally:
        try:
            cleanup_directories()
        except OSError:
            logger.exception("Failed to clean uploads and outputs after detection")


async def _detect_impl(
    file: UploadFile,
    lat: float | None,
    lng: float | None,
):
    # 1. Save uploaded image temporarily
    image_path = await save_upload(file)

    # 2. Try extracting GPS from image
    location = extract_gps(image_path)

    if not location:
        if lat is None or lng is None:
            return {"error": "Location not found"}

        location = {
            "latitude": lat,
            "longitude": lng,
        }

    latitude = location["latitude"]
    longitude = location["longitude"]

    # 3. Run YOLO detection
    detection = detect_road_damage(image_path)

    # 4. Stop if no defects were found
    if not detection["detections"]:
        return {"error": "Defects not found"}

    # 5. Find nearest road
    road = find_nearest_road(latitude, longitude)

    if not road:
        return {"error": "Location not found"}

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
                return {"error": "Complaint already registered"}

        # 7. Upload ONLY annotated image to Supabase Storage
        try:
            annotated_image_url = upload_image(detection["image"])
        except Exception:
            return {"error": "Image upload failed"}

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

            inserted_defects.append({
                "id": defect_id,
                "type": det["class"],
                "confidence": det["confidence"],
                "severity": severity,
            })

        # 9. Recalculate RHI from all defects on this road in this transaction
        road["rhi"] = calculate_rhi(road["id"], cur)

        # 10. Commit
        conn.commit()

        # 11. Return response
        return {
            "filename": file.filename,
            "location": location,
            "road": road,
            "defects": inserted_defects,
            "annotated_image": annotated_image_url,
        }

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()