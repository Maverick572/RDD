from fastapi import APIRouter
import psycopg2
import os

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()


def is_duplicate_defect(
    road_id: int,
    defect_type: str,
    latitude: float,
    longitude: float,
    cursor,
    radius_meters: float = 30.0,
) -> bool:

    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM defects
            WHERE road_id = %s
              AND type = %s
              AND ST_DWithin(
                  location,
                  ST_SetSRID(
                      ST_MakePoint(%s, %s),
                      4326
                  )::geography,
                  %s
              )
        );
        """,
        (
            road_id,
            defect_type,
            longitude,
            latitude,
            radius_meters,
        ),
    )

    return cursor.fetchone()[0]