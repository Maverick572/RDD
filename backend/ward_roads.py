from fastapi import APIRouter
import psycopg2
import os
import json

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


@router.get("/wards/{ward_number}/roads")
def get_ward_roads(ward_number: int):
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                r.id,
                r.name,
                r.type,
                r.rhi,
                COALESCE(r.defect_count, 0) AS defect_count,
                ST_AsGeoJSON(r.geometry) AS geometry
            FROM roads r
            JOIN wards w
                ON ST_Intersects(
                    r.geometry,
                    w.geometry
                )
            WHERE w.ward_number = %s
            ORDER BY r.rhi DESC NULLS LAST;
            """,
            (ward_number,)
        )

        rows = cur.fetchall()

        roads = []

        for row in rows:
            geo = None
            if row[5]:
                try:
                    geo = json.loads(row[5])
                except Exception:
                    geo = None
            roads.append({
                "id": row[0],
                "name": row[1] or "Unnamed Road",
                "type": row[2] or "road",
                "rhi": row[3],
                "defect_count": row[4],
                "geometry": geo
            })

        return {
            "ward_number": ward_number,
            "roads": roads
        }

    finally:
        conn.close()