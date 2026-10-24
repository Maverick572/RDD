"""
iot.py — Hardware input receiver for the ESP32-CAM + NEO-6M + MPU6050.

Run from the directory containing this file:
    uvicorn iot:app --host 0.0.0.0 --port 8000

Valid captures are passed through the shared detection pipeline in
backend.detect, which handles YOLO, road matching, and database updates.

Expected ESP32 request:
- POST /detect (also accepts /iot/ingest)
- multipart field "file": JPEG image
- multipart field "metadata": JSON string
- optional query parameters "lat" and "lng" for compatibility

Uploads, telemetry, and inference previews are kept in a bounded in-memory
buffer and cleared on restart.
"""

from __future__ import annotations

import json
import re
from collections import deque
from datetime import datetime, timezone
from io import BytesIO
from threading import Lock
from typing import Any, Optional
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response

app = FastAPI(
    title="IoT Hardware Receiver",
    description="Receives JPEG images and GPS/MPU6050 telemetry from ESP32-CAM.",
    version="1.0.0",
)

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MiB
MAX_STORED_RECORDS = 20
RECENT_RECORDS: deque[dict[str, Any]] = deque()
RECENT_IMAGES: dict[str, bytes] = {}
RECENT_INFERENCE_IMAGES: dict[str, bytes] = {}
RECORDS_LOCK = Lock()
ACTIVE_CAPTURE_ID: str | None = None
ACTIVE_CAPTURE_STATE: str | None = None


def safe_float(value: Any) -> Optional[float]:
    """Convert a value to a finite float, otherwise return None."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def clean_axis_stats(value: Any) -> dict[str, list[Optional[float]]]:
    """Normalize the MPU6050 mean/min/max vectors to three finite values."""
    if not isinstance(value, dict):
        value = {}

    result: dict[str, list[Optional[float]]] = {}
    for statistic in ("mean", "min", "max"):
        values = value.get(statistic)
        if not isinstance(values, list):
            values = []
        result[statistic] = [
            safe_float(values[index]) if index < len(values) else None
            for index in range(3)
        ]
    return result


def clean_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Normalize GPS and the ESP32 MPU6050 rolling summary."""
    gps = metadata.get("gps")
    imu = metadata.get("imu")

    if not isinstance(gps, dict):
        gps = {}
    if not isinstance(imu, dict):
        imu = {}

    acceleration = imu.get("acceleration_m_s2")
    if not isinstance(acceleration, dict):
        acceleration = {}
    gyroscope = imu.get("gyroscope_rad_s")
    if not isinstance(gyroscope, dict):
        gyroscope = {}

    result = {
        "device_uptime_ms": metadata.get("device_uptime_ms"),
        "sensor_source": metadata.get("sensor_source"),
        "gps": {
            "valid": bool(gps.get("valid", False)),
            "latitude": safe_float(gps.get("latitude")),
            "longitude": safe_float(gps.get("longitude")),
            "speed_valid": bool(
                gps.get("speed_valid", gps.get("speed_kmph") is not None)
            ),
            "speed_kmph": safe_float(gps.get("speed_kmph")),
            "location_age_ms": safe_float(
                gps.get("location_age_ms", gps.get("age_ms"))
            ),
        },
        "imu": {
            "valid": bool(imu.get("valid", False)),
            "window_ms": safe_float(imu.get("window_ms")),
            "window_start_uptime_ms": safe_float(
                imu.get("window_start_uptime_ms")
            ),
            "window_end_uptime_ms": safe_float(imu.get("window_end_uptime_ms")),
            "sample_count": safe_float(imu.get("sample_count")),
            "sampling_target_hz": safe_float(imu.get("sampling_target_hz")),
            "dynamic_magnitude_rms": safe_float(
                imu.get("dynamic_magnitude_rms")
            ),
            "dynamic_magnitude_max": safe_float(
                imu.get("dynamic_magnitude_max")
            ),
            "acceleration_m_s2": {
                **clean_axis_stats(acceleration),
                "magnitude_mean": safe_float(acceleration.get("magnitude_mean")),
                "magnitude_max": safe_float(acceleration.get("magnitude_max")),
                "magnitude_rms": safe_float(acceleration.get("magnitude_rms")),
                "dynamic_magnitude_max": safe_float(
                    acceleration.get("dynamic_magnitude_max")
                ),
                "dynamic_magnitude_rms": safe_float(
                    acceleration.get("dynamic_magnitude_rms")
                ),
            },
            "gyroscope_rad_s": clean_axis_stats(gyroscope),
        },
    }
    return result


@app.get("/")
async def root():
    return {
        "service": "IoT Hardware Receiver",
        "status": "running",
        "upload_endpoint": "/detect",
        "health_endpoint": "/health",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "iot-receiver"}


@app.get("/iot/records")
async def get_recent_records():
    with RECORDS_LOCK:
        return {"records": list(RECENT_RECORDS)}


@app.get("/iot/status")
async def get_receiver_status():
    with RECORDS_LOCK:
        return {
            "busy": ACTIVE_CAPTURE_ID is not None,
            "capture_id": ACTIVE_CAPTURE_ID,
            "state": ACTIVE_CAPTURE_STATE,
        }


@app.post("/iot/ack/{record_id}")
async def acknowledge_inference_display(record_id: str):
    global ACTIVE_CAPTURE_ID, ACTIVE_CAPTURE_STATE

    with RECORDS_LOCK:
        if ACTIVE_CAPTURE_ID != record_id or ACTIVE_CAPTURE_STATE != "awaiting_display":
            raise HTTPException(
                status_code=409,
                detail="This capture is not waiting for display acknowledgement",
            )
        ACTIVE_CAPTURE_ID = None
        ACTIVE_CAPTURE_STATE = None

    return {"ok": True, "message": "Capture acknowledged"}


@app.get("/iot/images/{record_id}")
async def get_received_image(record_id: str):
    with RECORDS_LOCK:
        image_bytes = RECENT_IMAGES.get(record_id)
    if image_bytes is None:
        raise HTTPException(status_code=404, detail="Image not found in memory")
    return Response(content=image_bytes, media_type="image/jpeg")


@app.get("/iot/inference-images/{record_id}")
async def get_inference_image(record_id: str):
    with RECORDS_LOCK:
        image_bytes = RECENT_INFERENCE_IMAGES.get(record_id)
    if image_bytes is None:
        raise HTTPException(
            status_code=404,
            detail="Inference image is not available in memory",
        )
    return Response(content=image_bytes, media_type="image/jpeg")


@app.post("/detect")
@app.post("/iot/ingest")
async def receive_hardware_input(
    file: UploadFile = File(...),
    metadata: str = Form("{}"),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
):
    """
    Receive a JPEG plus a JSON metadata form field.

    The ESP32 may also include lat/lng in the query string. If the JSON GPS
    location is absent/invalid, these query values are used as a fallback.
    """
    global ACTIVE_CAPTURE_ID, ACTIVE_CAPTURE_STATE

    record_id = uuid4().hex
    with RECORDS_LOCK:
        if ACTIVE_CAPTURE_ID is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "IoT capture ignored until the current inference image "
                    "has been displayed and acknowledged"
                ),
            )
        ACTIVE_CAPTURE_ID = record_id
        ACTIVE_CAPTURE_STATE = "processing"

    try:
        return await _receive_hardware_input(
            file,
            metadata,
            lat,
            lng,
            record_id,
        )
    finally:
        with RECORDS_LOCK:
            if (
                ACTIVE_CAPTURE_ID == record_id
                and ACTIVE_CAPTURE_STATE != "awaiting_display"
            ):
                ACTIVE_CAPTURE_ID = None
                ACTIVE_CAPTURE_STATE = None


async def _receive_hardware_input(
    file: UploadFile,
    metadata: str,
    lat: Optional[float],
    lng: Optional[float],
    record_id: str,
):
    global ACTIVE_CAPTURE_STATE

    filename = file.filename or "frame.jpg"
    content_type = (file.content_type or "").lower()

    if content_type and content_type not in {
        "image/jpeg",
        "image/jpg",
        "application/octet-stream",
    }:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image content type: {content_type}",
        )

    image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
    await file.close()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the {MAX_IMAGE_BYTES // (1024 * 1024)} MiB limit",
        )

    # JPEG files normally start with FF D8 and end with FF D9.
    if not (image_bytes.startswith(b"\xff\xd8") and image_bytes.endswith(b"\xff\xd9")):
        raise HTTPException(status_code=400, detail="Upload is not a valid JPEG image")

    try:
        parsed_metadata = json.loads(metadata or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="metadata must be valid JSON") from exc

    if not isinstance(parsed_metadata, dict):
        raise HTTPException(status_code=400, detail="metadata must be a JSON object")

    cleaned = clean_metadata(parsed_metadata)

    # Prefer valid coordinates in the JSON metadata; use query values otherwise.
    gps = cleaned["gps"]
    if gps["latitude"] is None:
        gps["latitude"] = safe_float(lat)
    if gps["longitude"] is None:
        gps["longitude"] = safe_float(lng)

    query_location_valid = lat is not None and lng is not None
    gps["valid"] = bool(
        gps["valid"] and gps["latitude"] is not None and gps["longitude"] is not None
    ) or query_location_valid

    # Basic coordinate validation.
    if gps["latitude"] is not None and not -90 <= gps["latitude"] <= 90:
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
    if gps["longitude"] is not None and not -180 <= gps["longitude"] <= 180:
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")

    received_at = datetime.now(timezone.utc).isoformat()

    gps_location_valid = bool(gps["valid"])
    pipeline_latitude = gps["latitude"] if gps_location_valid else safe_float(lat)
    pipeline_longitude = gps["longitude"] if gps_location_valid else safe_float(lng)
    imu = cleaned["imu"]
    vibration_rms = (
        imu["dynamic_magnitude_rms"]
        if imu["valid"]
        else None
    )
    if vibration_rms is None and imu["valid"]:
        vibration_rms = imu["acceleration_m_s2"]["dynamic_magnitude_rms"]

    from backend.detect import process_detection

    pipeline_file = UploadFile(
        filename=f"{record_id}.jpg",
        file=BytesIO(image_bytes),
    )
    pipeline_result = await process_detection(
        pipeline_file,
        pipeline_latitude,
        pipeline_longitude,
        vibration_rms,
        iot_capture=True,
    )
    inference_image = pipeline_result.pop("_inference_image_bytes", None)
    encoded_pipeline_result = jsonable_encoder(pipeline_result)

    record = {
        "id": record_id,
        "received_at_utc": received_at,
        "original_filename": re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:120],
        "image_filename": f"{record_id}.jpg",
        "image_size_bytes": len(image_bytes),
        **cleaned,
        "detection": encoded_pipeline_result,
    }

    with RECORDS_LOCK:
        if len(RECENT_RECORDS) >= MAX_STORED_RECORDS:
            oldest_record = RECENT_RECORDS.popleft()
            RECENT_IMAGES.pop(oldest_record["id"], None)
            RECENT_INFERENCE_IMAGES.pop(oldest_record["id"], None)
        RECENT_RECORDS.append(record)
        RECENT_IMAGES[record_id] = image_bytes
        if isinstance(inference_image, bytes):
            RECENT_INFERENCE_IMAGES[record_id] = inference_image
        ACTIVE_CAPTURE_STATE = "awaiting_display"

    return JSONResponse(
        status_code=200,
        content={
            "ok": True,
            "message": "Hardware input received",
            "id": record_id,
            "image_filename": record["image_filename"],
            "image_size_bytes": len(image_bytes),
            "gps": gps,
            "imu": cleaned["imu"],
            "sensor_source": cleaned["sensor_source"],
            "detection": encoded_pipeline_result,
            "received_at_utc": received_at,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("iot:app", host="0.0.0.0", port=8000, reload=False)
