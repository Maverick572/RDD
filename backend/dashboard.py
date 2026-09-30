from fastapi import APIRouter, Query
import psycopg2
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter()

DEFECT_TYPE_LABELS = {
    "D00": "Longitudinal Crack",
    "D10": "Equal-Interval Crack",
    "D20": "Alligator Crack",
    "D40": "Pothole / Rutting",
    "pothole": "Pothole",
    "crack": "Surface Crack",
    "rutting": "Rutting",
    "edge_break": "Edge Break",
    "faded_marking": "Faded Marking",
}


def get_type_label(defect_type: str) -> str:
    return DEFECT_TYPE_LABELS.get(defect_type, defect_type.replace("_", " ").title())


# ---------------------------------------------------------
# 1. Dashboard Summary KPI & Analytics
# ---------------------------------------------------------
@router.get("/dashboard/summary")
def get_dashboard_summary():
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        # Total Wards
        cur.execute("SELECT COUNT(*) FROM wards;")
        total_wards = cur.fetchone()[0] or 0

        # Total Roads
        cur.execute("SELECT COUNT(*) FROM roads;")
        total_roads = cur.fetchone()[0] or 0

        # Total Defects
        cur.execute("SELECT COUNT(*) FROM defects;")
        total_defects = cur.fetchone()[0] or 0

        # Wards with at least one defect
        cur.execute(
            """
            SELECT COUNT(DISTINCT w.id)
            FROM wards w
            JOIN defects d
                ON ST_Intersects(d.location, w.geometry);
            """
        )
        wards_with_defects = cur.fetchone()[0] or 0

        # Defects by severity
        cur.execute(
            """
            SELECT severity, COUNT(*)
            FROM defects
            GROUP BY severity;
            """
        )
        sev_rows = cur.fetchall()
        sev_map = {"high": 0, "medium": 0, "low": 0}
        for sev, count in sev_rows:
            if sev in sev_map:
                sev_map[sev] = count
            else:
                sev_map[sev] = count

        defects_by_severity = [
            {"severity": "high", "count": sev_map.get("high", 0)},
            {"severity": "medium", "count": sev_map.get("medium", 0)},
            {"severity": "low", "count": sev_map.get("low", 0)},
        ]

        # Defects by type
        cur.execute(
            """
            SELECT type, COUNT(*)
            FROM defects
            GROUP BY type
            ORDER BY COUNT(*) DESC;
            """
        )
        type_rows = cur.fetchall()
        defects_by_type = [
            {
                "type": row[0],
                "name": get_type_label(row[0]),
                "count": row[1],
            }
            for row in type_rows
        ]

        # Top distress wards
        cur.execute(
            """
            SELECT
                w.id,
                w.ward_number,
                w.node,
                w.municipal_corporation,
                COUNT(d.id) AS defect_count
            FROM wards w
            JOIN defects d
                ON ST_Intersects(d.location, w.geometry)
            GROUP BY w.id, w.ward_number, w.node, w.municipal_corporation
            ORDER BY defect_count DESC
            LIMIT 6;
            """
        )
        top_ward_rows = cur.fetchall()
        top_distress_wards = [
            {
                "id": row[0],
                "ward_number": row[1],
                "node": row[2] or f"Ward {row[1]}",
                "municipal_corporation": row[3] or "Navi Mumbai",
                "defect_count": row[4],
            }
            for row in top_ward_rows
        ]

        # Recent defects
        cur.execute(
            """
            SELECT
                d.id,
                d.type,
                d.confidence,
                d.severity,
                ST_Y(d.location::geometry) AS latitude,
                ST_X(d.location::geometry) AS longitude,
                d.image_url,
                d.timestamp,
                r.name AS road_name,
                r.type AS road_type
            FROM defects d
            LEFT JOIN roads r ON d.road_id = r.id
            ORDER BY d.timestamp DESC
            LIMIT 10;
            """
        )
        recent_rows = cur.fetchall()
        recent_defects = [
            {
                "id": row[0],
                "type": row[1],
                "type_name": get_type_label(row[1]),
                "confidence": round(row[2], 3) if row[2] is not None else None,
                "severity": row[3],
                "latitude": row[4],
                "longitude": row[5],
                "image_url": row[6],
                "timestamp": row[7].isoformat() if isinstance(row[7], datetime) else str(row[7]),
                "road_name": row[8] or "Unnamed Road",
                "road_type": row[9] or "road",
            }
            for row in recent_rows
        ]

        return {
            "total_wards": total_wards,
            "total_roads": total_roads,
            "total_defects": total_defects,
            "wards_with_defects": wards_with_defects,
            "defects_by_severity": defects_by_severity,
            "defects_by_type": defects_by_type,
            "top_distress_wards": top_distress_wards,
            "recent_defects": recent_defects,
        }

    finally:
        conn.close()


# ---------------------------------------------------------
# 2. All Defects for Map Display
# ---------------------------------------------------------
@router.get("/dashboard/defects")
def get_dashboard_defects():
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
                d.timestamp,
                r.name AS road_name,
                r.type AS road_type,
                r.rhi AS road_rhi
            FROM defects d
            LEFT JOIN roads r ON d.road_id = r.id
            ORDER BY d.timestamp DESC;
            """
        )

        rows = cur.fetchall()
        defects = [
            {
                "id": row[0],
                "road_id": row[1],
                "type": row[2],
                "type_name": get_type_label(row[2]),
                "confidence": round(row[3], 3) if row[3] is not None else None,
                "severity": row[4],
                "latitude": row[5],
                "longitude": row[6],
                "image_url": row[7],
                "timestamp": row[8].isoformat() if isinstance(row[8], datetime) else str(row[8]),
                "road_name": row[9] or "Unnamed Road",
                "road_type": row[10] or "road",
                "road_rhi": row[11],
            }
            for row in rows
        ]

        return {"defects": defects, "count": len(defects)}

    finally:
        conn.close()


# ---------------------------------------------------------
# 3. Roads within Bounding Box (for Zoomed-in Map Inspection)
# ---------------------------------------------------------
@router.get("/dashboard/roads")
def get_dashboard_roads_bbox(
    min_lat: float = Query(...),
    min_lng: float = Query(...),
    max_lat: float = Query(...),
    max_lng: float = Query(...),
    limit: int = Query(500, le=1500),
):
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
                ST_AsGeoJSON(r.geometry) AS geometry
            FROM roads r
            WHERE ST_Intersects(
                r.geometry,
                ST_MakeEnvelope(%s, %s, %s, %s, 4326)::geography
            )
            LIMIT %s;
            """,
            (min_lng, min_lat, max_lng, max_lat, limit),
        )

        rows = cur.fetchall()
        roads = []

        for row in rows:
            geo = None
            if row[4]:
                try:
                    geo = json.loads(row[4])
                except Exception:
                    geo = None

            roads.append({
                "id": row[0],
                "name": row[1] or "Unnamed Road",
                "type": row[2] or "road",
                "rhi": row[3],
                "geometry": geo,
            })

        return {"roads": roads, "count": len(roads)}

    finally:
        conn.close()
