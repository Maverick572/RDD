"""Live Streamlit dashboard for ESP32-CAM images and sensor telemetry.

Run from the repository root with:
    streamlit run backend/iot_dashboard.py
"""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

import streamlit as st

IOT_API_URL = os.environ.get("IOT_API_URL", "http://127.0.0.1:8000").rstrip("/")


def load_records() -> list[dict[str, Any]]:
    """Fetch recent telemetry from the in-memory receiver API."""
    with urlopen(f"{IOT_API_URL}/iot/records", timeout=5) as response:
        payload = json.load(response)
    records = payload.get("records")
    if not isinstance(records, list) or not all(
        isinstance(record, dict) for record in records
    ):
        raise ValueError("Receiver returned an invalid telemetry response")
    return records


def load_receiver_status() -> dict[str, Any]:
    with urlopen(f"{IOT_API_URL}/iot/status", timeout=5) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("Receiver returned an invalid status response")
    return payload


def acknowledge_capture(record_id: str) -> None:
    request = Request(
        f"{IOT_API_URL}/iot/ack/{record_id}",
        data=b"",
        method="POST",
    )
    with urlopen(request, timeout=5) as response:
        if response.status != 200:
            raise ValueError("Receiver did not accept the display acknowledgement")


def display_value(value: Any, suffix: str = "") -> str:
    """Format optional numeric telemetry for Streamlit metrics."""
    if value is None:
        return "N/A"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return f"{value}{suffix}"


def axis_rows(section: Any) -> list[dict[str, Any]]:
    if not isinstance(section, dict):
        return []

    mean = section.get("mean", [])
    minimum = section.get("min", [])
    maximum = section.get("max", [])
    if not all(isinstance(values, list) for values in (mean, minimum, maximum)):
        return []

    return [
        {
            "Axis": axis,
            "Mean": mean[index],
            "Min": minimum[index],
            "Max": maximum[index],
        }
        for index, axis in enumerate(("X", "Y", "Z"))
        if index < len(mean) and index < len(minimum) and index < len(maximum)
    ]


def load_image(record_id: str) -> bytes:
    """Fetch a JPEG from the receiver without saving it to disk."""
    with urlopen(f"{IOT_API_URL}/iot/images/{record_id}", timeout=5) as response:
        return response.read()


def load_inference_image(record_id: str) -> bytes:
    """Fetch the model output image retained in the receiver's memory."""
    with urlopen(
        f"{IOT_API_URL}/iot/inference-images/{record_id}",
        timeout=5,
    ) as response:
        return response.read()


st.set_page_config(page_title="IoT Road Monitor", page_icon="📡", layout="wide")
st.title("IoT Road Monitor")
st.caption("Live Arduino UNO GPS and vibration readings relayed by the ESP32-CAM.")


@st.fragment(run_every="3s")
def show_latest_data() -> None:
    try:
        records = load_records()
        receiver_status = load_receiver_status()
    except (OSError, ValueError, URLError) as exc:
        st.error(
            f"Could not reach the IoT receiver at {IOT_API_URL}: {exc}. "
            "Start the receiver before opening the dashboard."
        )
        return

    if not records:
        st.info("Waiting for the first ESP32 upload...")
        return

    latest = records[-1]
    gps = latest.get("gps")
    if not isinstance(gps, dict):
        gps = {}
    imu = latest.get("imu")
    if not isinstance(imu, dict):
        imu = {}

    raw_image_column, inference_column, gps_column = st.columns([1, 1, 1])
    with raw_image_column:
        st.subheader("Captured image")
        record_id = latest.get("id")
        if not isinstance(record_id, str):
            st.warning("The latest telemetry record has no valid image ID.")
        else:
            try:
                image_bytes = load_image(record_id)
            except (OSError, URLError) as exc:
                st.warning(f"Could not load the latest image: {exc}")
            else:
                st.image(image_bytes, caption=latest.get("received_at_utc"))

    detection = latest.get("detection")
    if not isinstance(detection, dict):
        detection = {}
    with inference_column:
        st.subheader("AI inference")
        annotation_displayed = False
        if isinstance(record_id, str):
            try:
                annotated_image = load_inference_image(record_id)
            except (OSError, URLError) as exc:
                if detection.get("annotated_image"):
                    st.warning(f"Could not load the AI inference image: {exc}")
                else:
                    st.info(
                        detection.get(
                            "error",
                            "No annotated inference image is available.",
                        )
                    )
            else:
                st.image(annotated_image, caption="YOLO detections")
                annotation_displayed = True
        else:
            st.warning("The latest telemetry record has no valid image ID.")

        if (
            annotation_displayed
            and receiver_status.get("capture_id") == record_id
            and receiver_status.get("state") == "awaiting_display"
        ):
            st.info("New IoT captures are paused until you acknowledge this image.")
            if st.button(
                "I've viewed the inference image — accept next capture",
                key=f"ack-{record_id}",
            ):
                try:
                    acknowledge_capture(record_id)
                except (OSError, ValueError, URLError) as exc:
                    st.error(f"Could not acknowledge this image: {exc}")
                else:
                    st.success("Acknowledged. The receiver can accept the next capture.")
                    st.rerun()
        elif receiver_status.get("state") == "processing":
            st.info("IoT capture is being processed; new captures are temporarily ignored.")

    with gps_column:
        st.subheader("GPS")
        latitude, longitude = st.columns(2)
        latitude.metric("Latitude", display_value(gps.get("latitude")))
        longitude.metric("Longitude", display_value(gps.get("longitude")))
        speed = gps.get("speed_kmph") if gps.get("speed_valid", True) else None
        gps_status = "Valid fix" if gps.get("valid") else "No fix"
        st.metric("Status", gps_status)
        st.metric("Speed", display_value(speed, " km/h"))
        st.caption(
            "Location age: "
            f"{display_value(gps.get('location_age_ms', gps.get('age_ms')), ' ms')}"
        )

    st.subheader("Vibration (MPU6050 via Arduino)")
    sample_col, window_col, rate_col = st.columns(3)
    sample_col.metric(
        "RMS dynamic acceleration",
        display_value(imu.get("dynamic_magnitude_rms"), " m/s²"),
    )
    window_col.metric("Window", display_value(imu.get("window_ms"), " ms"))
    rate_col.metric(
        "Peak dynamic acceleration",
        display_value(imu.get("dynamic_magnitude_max"), " m/s²"),
    )
    st.caption(
        f"Sensor status: {'Valid' if imu.get('valid') else 'Unavailable'} · "
        f"Arduino samples: {display_value(imu.get('sample_count'))} · "
        f"Target rate: {display_value(imu.get('sampling_target_hz'), ' Hz')} · "
        f"Source: {latest.get('sensor_source') or 'Not provided'}"
    )

    acceleration = imu.get("acceleration_m_s2")
    gyroscope = imu.get("gyroscope_rad_s")
    acceleration_column, gyroscope_column = st.columns(2)
    with acceleration_column:
        st.markdown("**Acceleration by axis (m/s²)**")
        rows = axis_rows(acceleration)
        if rows:
            st.dataframe(rows, hide_index=True, width="stretch")
        if isinstance(acceleration, dict):
            st.caption(
                "Magnitude mean / max / RMS: "
                f"{display_value(acceleration.get('magnitude_mean'))} / "
                f"{display_value(acceleration.get('magnitude_max'))} / "
                f"{display_value(acceleration.get('magnitude_rms'))} m/s²"
            )
            st.caption(
                "Dynamic magnitude RMS / peak: "
                f"{display_value(acceleration.get('dynamic_magnitude_rms'))} / "
                f"{display_value(acceleration.get('dynamic_magnitude_max'))} m/s²"
            )
    with gyroscope_column:
        st.markdown("**Gyroscope by axis (rad/s)**")
        rows = axis_rows(gyroscope)
        if rows:
            st.dataframe(rows, hide_index=True, width="stretch")

    with st.expander("Full latest telemetry"):
        st.json(latest)

    defects = detection.get("defects")
    if isinstance(defects, list) and defects:
        st.subheader("Detected defects")
        st.dataframe(defects, hide_index=True, width="stretch")
        road = detection.get("road")
        if isinstance(road, dict):
            st.write(
                f"Nearest road: {road.get('name') or road.get('id')} "
                f"({display_value(road.get('distance'), ' m')})"
            )
    elif detection.get("error"):
        st.info(f"Detection pipeline: {detection['error']}")
    formula = detection.get("severity_formula")
    if isinstance(formula, str):
        st.caption(f"IoT severity formula: {formula}")

    st.subheader("Recent uploads")
    history = []
    for record in reversed(records):
        record_gps = record.get("gps")
        record_imu = record.get("imu")
        if not isinstance(record_gps, dict):
            record_gps = {}
        if not isinstance(record_imu, dict):
            record_imu = {}
        record_detection = record.get("detection")
        if not isinstance(record_detection, dict):
            record_detection = {}
        record_defects = record_detection.get("defects")
        history.append(
            {
                "Received (UTC)": record.get("received_at_utc"),
                "GPS fix": bool(record_gps.get("valid")),
                "Latitude": record_gps.get("latitude"),
                "Longitude": record_gps.get("longitude"),
                "Vibration RMS (m/s²)": record_imu.get("dynamic_magnitude_rms"),
                "Vibration peak (m/s²)": record_imu.get("dynamic_magnitude_max"),
                "Defects": len(record_defects) if isinstance(record_defects, list) else 0,
                "Image": record.get("image_filename"),
            }
        )
    st.dataframe(history, hide_index=True, width="stretch")


show_latest_data()
