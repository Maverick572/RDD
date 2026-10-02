from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import psycopg2
import os

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


class MaintenanceRequest(BaseModel):
    road_id: int
    scheduled_date: datetime
    maintenance_type: str


@router.post("/maintenance/schedule")
def schedule_maintenance(data: MaintenanceRequest):
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO maintenance (
                road_id,
                scheduled_date,
                progress,
                status,
                maintenance_type
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                id,
                road_id,
                scheduled_date,
                progress,
                status,
                maintenance_type;
            """,
            (
                data.road_id,
                data.scheduled_date,
                0.0,
                "scheduled",
                data.maintenance_type,
            ),
        )

        row = cur.fetchone()
        conn.commit()

        return {
            "id": row[0],
            "road_id": row[1],
            "scheduled_date": row[2],
            "progress": row[3],
            "status": row[4],
            "maintenance_type": row[5],
        }

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to schedule maintenance"
        )

    finally:
        conn.close()