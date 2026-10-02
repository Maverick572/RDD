from fastapi import APIRouter, HTTPException
import psycopg2
import os

from dotenv import load_dotenv
from backend.calculate_rhi import calculate_rhi

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


@router.post("/maintenance/{maintenance_id}/complete")
def complete_maintenance(maintenance_id: int):
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        # Fetch the active maintenance record
        cur.execute(
            """
            SELECT
                road_id,
                scheduled_date,
                maintenance_type
            FROM maintenance
            WHERE id = %s
            FOR UPDATE;
            """,
            (maintenance_id,),
        )

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Maintenance record not found"
            )

        road_id, start_date, maintenance_type = row

        # Move it to history
        cur.execute(
            """
            INSERT INTO maintenance_history (
                road_id,
                start_date,
                completed_date,
                maintenance_type
            )
            VALUES (
                %s,
                %s,
                NOW(),
                %s
            )
            RETURNING
                id,
                completed_date;
            """,
            (
                road_id,
                start_date,
                maintenance_type,
            ),
        )

        history_id, completed_date = cur.fetchone()

        # Remove from active maintenance
        cur.execute(
            """
            DELETE FROM maintenance
            WHERE id = %s;
            """,
            (maintenance_id,),
        )

        # Completing the repair clears recorded defects and recalculates the
        # road health; calculate_rhi also appends the new state to road_history.
        cur.execute(
            """
            DELETE FROM defects
            WHERE road_id = %s;
            """,
            (road_id,),
        )
        deleted_defects = cur.rowcount
        rhi = calculate_rhi(road_id, cur)

        conn.commit()

        return {
            "message": "Maintenance completed",
            "maintenance_history_id": history_id,
            "road_id": road_id,
            "start_date": start_date,
            "completed_date": completed_date,
            "maintenance_type": maintenance_type,
            "deleted_defects": deleted_defects,
            "rhi": rhi,
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to complete maintenance"
        )

    finally:
        conn.close()