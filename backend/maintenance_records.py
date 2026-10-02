import os

import psycopg2
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


@router.get("/wards/{ward_number}/maintenance")
def get_ward_maintenance(ward_number: int):
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                m.id,
                m.road_id,
                m.scheduled_date,
                m.progress,
                m.status,
                m.maintenance_type,
                r.name,
                r.type,
                r.rhi,
                COALESCE(r.defect_count, 0)
            FROM maintenance m
            JOIN roads r ON r.id = m.road_id
            JOIN wards w ON ST_Intersects(r.geometry, w.geometry)
            WHERE w.ward_number = %s
            ORDER BY m.scheduled_date ASC, m.id ASC;
            """,
            (ward_number,),
        )

        return {
            "ward_number": ward_number,
            "maintenance": [
                {
                    "id": row[0],
                    "road_id": row[1],
                    "scheduled_date": row[2],
                    "progress": row[3],
                    "status": row[4],
                    "maintenance_type": row[5],
                    "road_name": row[6] or "Unnamed Road",
                    "road_type": row[7] or "road",
                    "rhi": row[8],
                    "defect_count": row[9],
                }
                for row in cur.fetchall()
            ],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch ward maintenance records",
        ) from exc
    finally:
        conn.close()


@router.get("/wards/{ward_number}/maintenance/history")
def get_ward_maintenance_history(ward_number: int):
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                h.id,
                h.road_id,
                h.start_date,
                h.completed_date,
                h.maintenance_type,
                r.name,
                r.type
            FROM maintenance_history h
            JOIN roads r ON r.id = h.road_id
            JOIN wards w ON ST_Intersects(r.geometry, w.geometry)
            WHERE w.ward_number = %s
            ORDER BY h.completed_date DESC NULLS LAST, h.id DESC;
            """,
            (ward_number,),
        )

        return {
            "ward_number": ward_number,
            "maintenance_history": [
                {
                    "id": row[0],
                    "road_id": row[1],
                    "start_date": row[2],
                    "completed_date": row[3],
                    "maintenance_type": row[4],
                    "road_name": row[5] or "Unnamed Road",
                    "road_type": row[6] or "road",
                }
                for row in cur.fetchall()
            ],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch ward maintenance history",
        ) from exc
    finally:
        conn.close()
