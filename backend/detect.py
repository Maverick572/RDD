from fastapi import APIRouter, UploadFile, File, Query

from backend.storage import save_upload
from backend.metadata import extract_gps
from backend.inference import detect_road_damage
from backend.find_nearest import find_nearest_road
from backend.supabase_storage import upload_image

import psycopg2
import os

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


@router.post("/detect")
async def detect(
    file: UploadFile = File(...),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
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

    # 6. Upload ONLY annotated image to Supabase Storage
    try:
        annotated_image_url = upload_image(detection["image"])
    except Exception:
        return {"error": "Image upload failed"}

    # 7. Connect to database
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()
        inserted_defects = []

        # 8. Insert detected defects
        for det in detection["detections"]:
            confidence = det["confidence"]

            if confidence >= 0.80:
                severity = "high"
            elif confidence >= 0.50:
                severity = "medium"
            else:
                severity = "low"

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
                    confidence,
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
                "confidence": confidence,
                "severity": severity,
            })

        # 9. Commit
        conn.commit()

        # 10. Return response
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