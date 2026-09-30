from fastapi import APIRouter
import psycopg2
import os
import json

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


# ---------------------------------------------------------
# Get all defects in a ward
# ---------------------------------------------------------
@router.get("/wards/{ward_number}/defects")
def get_ward_defects(ward_number: int):
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                d.id,
                d.road_id,
                d.type,
                d.confidence,
                d.severity,
                ST_Y(d.location::geometry) AS latitude,
                ST_X(d.location::geometry) AS longitude,
                d.image_url,
                d.timestamp
            FROM defects d
            JOIN wards w
                ON ST_Intersects(
                    d.location,
                    w.geometry
                )
            WHERE w.ward_number = %s
            ORDER BY d.timestamp DESC;
            """,
            (ward_number,)
        )

        rows = cur.fetchall()

        defects = []

        for row in rows:
            defects.append({
                "id": row[0],
                "road_id": row[1],
                "type": row[2],
                "confidence": row[3],
                "severity": row[4],
                "latitude": row[5],
                "longitude": row[6],
                "image_url": row[7],
                "timestamp": row[8],
            })

        return {
            "ward_number": ward_number,
            "defects": defects
        }

    finally:
        conn.close()


# ---------------------------------------------------------
# Get all wards with defect count and geometry
# ---------------------------------------------------------
@router.get("/wards")
def get_all_wards():
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                w.id,
                w.ward_number,
                w.node,
                w.municipal_corporation,
                COUNT(d.id) AS defect_count,
                ST_AsGeoJSON(w.geometry) AS geometry
            FROM wards w
            LEFT JOIN defects d
                ON ST_Intersects(
                    d.location,
                    w.geometry
                )
            GROUP BY
                w.id,
                w.ward_number,
                w.node,
                w.municipal_corporation,
                w.geometry
            ORDER BY w.ward_number;
            """
        )

        rows = cur.fetchall()

        wards = []

        for row in rows:
            wards.append({
                "id": row[0],
                "ward_number": row[1],
                "node": row[2],
                "municipal_corporation": row[3],
                "defect_count": row[4],
                "geometry": json.loads(row[5])
            })

        return {
            "wards": wards
        }

    finally:
        conn.close()