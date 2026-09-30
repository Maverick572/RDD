import os
import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

# Bounding box covering Navi Mumbai & surrounding region (min_lat, min_lon, max_lat, max_lon)
BBOX = (18.95, 72.95, 19.20, 73.12)

OVERPASS_ENDPOINTS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

QUERY = f"""
[out:json][timeout:120];
(
  way["highway"]({BBOX[0]}, {BBOX[1]}, {BBOX[2]}, {BBOX[3]});
);
out geom;
"""

def fetch_roads():
    print("Requesting roads from OpenStreetMap...", flush=True)

    for url in OVERPASS_ENDPOINTS:
        try:
            print(f"Querying endpoint: {url}...", flush=True)
            response = requests.post(
                url,
                data={"data": QUERY},
                headers={
                    "User-Agent": "RoadDefectDetection/1.0 (contact@rdd.local)",
                },
                timeout=120,
            )
            print(f"Response status: {response.status_code}", flush=True)

            if response.status_code == 200:
                elements = response.json().get("elements", [])
                print(f"Successfully retrieved {len(elements)} elements from OSM.", flush=True)
                return elements
        except Exception as e:
            print(f"Endpoint {url} failed: {e}", flush=True)

    raise RuntimeError("Failed to fetch road data from all Overpass API endpoints.")

def main():
    print("Starting road import...", flush=True)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not found in .env")

    roads = fetch_roads()
    print(f"Processing {len(roads)} road elements...", flush=True)

    records = []
    timestamp = datetime.now(timezone.utc)

    for road in roads:
        tags = road.get("tags", {})
        geometry = road.get("geometry", [])

        if len(geometry) < 2:
            continue

        name = tags.get("name") or tags.get("ref") or "Unnamed Road"
        road_type = tags.get("highway", "unclassified")

        coordinates = ",".join(
            f"{point['lon']} {point['lat']}"
            for point in geometry
        )
        wkt = f"LINESTRING({coordinates})"

        records.append((name, road_type, wkt, timestamp))

    print(f"Prepared {len(records)} valid road segments for database insertion.", flush=True)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    # Insert in batches of 1,000 for fast bulk insertion
    batch_size = 1000
    total_inserted = 0

    insert_query = """
    INSERT INTO roads (name, type, geometry, timestamp)
    VALUES %s
    """

    # Format template so PostGIS ST_GeogFromText parses WKT properly
    template = "(%s, %s, ST_GeogFromText(%s), %s)"

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        execute_values(cur, insert_query, batch, template=template)
        conn.commit()
        total_inserted += len(batch)
        print(f"Inserted and committed {total_inserted}/{len(records)} roads...", flush=True)

    cur.close()
    conn.close()

    print(f"Completed! Successfully inserted {total_inserted} road segments into Supabase.", flush=True)


if __name__ == "__main__":
    main()

