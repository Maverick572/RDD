from fastapi import APIRouter, Query
import psycopg2
import os
import json
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


def find_nearest_road(lat: float, lng: float, threshold: float = 100.0):
    if not DATABASE_URL:
        return None

    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                id,
                name,
                type,
                rhi,
                ST_AsGeoJSON(geometry) AS geometry,
                ST_Distance(
                    geometry,
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                ) AS distance_meters
            FROM roads
            ORDER BY geometry <-> ST_SetSRID(
                ST_MakePoint(%s, %s),
                4326
            )::geography
            LIMIT 1;
            """,
            (lng, lat, lng, lat),
        )

        road = cur.fetchone()

        if not road:
            return None

        road_id, name, road_type, rhi, geom_str, distance = road

        if threshold is not None and distance > threshold:
            return None

        return {
            "id": road_id,
            "name": name,
            "type": road_type,
            "rhi": rhi,
            "geometry": json.loads(geom_str) if geom_str else None,
            "distance": round(distance, 1),
        }

    finally:
        conn.close()


@router.get("/roads/nearest")
def get_nearest_road(
    lat: float = Query(...),
    lng: float = Query(...),
    threshold: float = Query(100.0),
):
    road = find_nearest_road(lat, lng, threshold=threshold)

    if not road:
        return {"road": None}

    return {"road": road, "distance": road.get("distance")}