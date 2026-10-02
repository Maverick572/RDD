from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import psycopg2
import os

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


class MaintenanceUpdate(BaseModel):
    status: str
    progress: float


@router.put("/maintenance/{maintenance_id}")
def update_maintenance(
    maintenance_id: int,
    data: MaintenanceUpdate
):
    if not 0 <= data.progress <= 100:
        raise HTTPException(
            status_code=400,
            detail="Progress must be between 0 and 100"
        )

    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        cur.execute(
            """
            UPDATE maintenance
            SET
                status = %s,
                progress = %s
            WHERE id = %s
            RETURNING
                id,
                road_id,
                scheduled_date,
                maintenance_type,
                status,
                progress;
            """,
            (
                data.status,
                data.progress,
                maintenance_id
            )
        )

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Maintenance record not found"
            )

        conn.commit()

        return {
            "id": row[0],
            "road_id": row[1],
            "scheduled_date": row[2],
            "maintenance_type": row[3],
            "status": row[4],
            "progress": row[5]
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update maintenance"
        )

    finally:
        conn.close()