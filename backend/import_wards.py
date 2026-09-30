import json
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Ensure .env values take precedence over stale shell variables
load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
GEOJSON_FILE = Path(__file__).parent / "Navi_Mumbai_Wards_with_nodes.geojson"


def import_wards():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set in .env")

    if not GEOJSON_FILE.exists():
        raise FileNotFoundError(f"GeoJSON file not found at {GEOJSON_FILE}")

    print(f"Reading {GEOJSON_FILE.name} ...")
    with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)

    try:
        cur = conn.cursor()

        # Clear existing ward data before importing
        cur.execute("TRUNCATE TABLE wards RESTART IDENTITY CASCADE;")

        count = 0
        features = data.get("features", [])

        for feature in features:
            properties = feature.get("properties", {})
            geometry = feature.get("geometry", {})

            ward_code = properties.get("sourcewardcode")
            ward_number = int(ward_code) if ward_code is not None else count + 1
            node = properties.get("node")

            cur.execute(
                """
                INSERT INTO wards (
                    ward_number,
                    node,
                    municipal_corporation,
                    geometry
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    ST_GeomFromGeoJSON(%s)::geography
                );
                """,
                (
                    ward_number,
                    node,
                    "NMMC",
                    json.dumps(geometry),
                ),
            )

            count += 1

        conn.commit()
        print(f"Successfully imported and committed {count} wards.")

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    import_wards()
