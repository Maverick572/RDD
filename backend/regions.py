#!/usr/bin/env python3
"""
Add OSM-derived 'node' field to Navi Mumbai ward GeoJSON.

Requirements:
    pip install requests shapely
"""

import json
import time
import requests
from shapely.geometry import shape
from pathlib import Path

# ----------------------------
# CONFIG
# ----------------------------
INPUT_GEOJSON  = "backend/wards_navi_mumbai.geojson"   # your file
OUTPUT_GEOJSON = "Navi_Mumbai_Wards_with_nodes.geojson"

# Nominatim requires a valid User-Agent
USER_AGENT = "NaviMumbaiNodeMapper/1.0 (maverck948@gmail.com)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
SLEEP_SECONDS = 1.1          # respect Nominatim rate limit (~1 req/sec)

# Optional: only accept these known Navi Mumbai nodes (helps clean noisy results)
KNOWN_NODES = {
    "kharghar", "nerul", "belapur", "cbd belapur", "sanpada", "vashi",
    "airoli", "ghansoli", "koparkhairane", "kopar khairane", "turbhe",
    "kalamboli", "kamothe", "seawoods", "juinagar", "ulwe", "dronagiri",
    "panvel", "taloja", "rabale", "mahape"
}

def get_centroid(geom):
    """Return (lon, lat) of polygon / multipolygon centroid."""
    g = shape(geom)
    c = g.centroid
    return c.x, c.y


def reverse_geocode(lon, lat):
    """
    Call Nominatim reverse geocoding.
    Returns a cleaned node name or None.
    """
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
        "zoom": 16,          # suburb / neighbourhood level
        "accept-language": "en"
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        r = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"  Nominatim error: {e}")
        return None

    address = data.get("address", {})

    # Prefer these keys in order of usefulness for Navi Mumbai
    candidates = [
        address.get("suburb"),
        address.get("neighbourhood"),
        address.get("quarter"),
        address.get("city_district"),
        address.get("town"),
        address.get("village"),
        address.get("hamlet"),
        address.get("locality"),
    ]

    for name in candidates:
        if not name:
            continue
        clean = name.strip()
        lower = clean.lower()

        # Keep only if it looks like a known node (optional filter)
        if any(k in lower for k in KNOWN_NODES):
            # Normalise a few common variants
            if "belapur" in lower and "cbd" in lower:
                return "CBD Belapur"
            if "kopar" in lower:
                return "Koparkhairane"
            return clean.title()

        # If no known-node filter match, still return the best candidate
        return clean.title()

    return None


def main():
    print(f"Loading {INPUT_GEOJSON} ...")
    with open(INPUT_GEOJSON, encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"Found {len(features)} wards")

    for i, feat in enumerate(features):
        props = feat.setdefault("properties", {})
        geom  = feat.get("geometry")

        if not geom:
            props["node"] = None
            continue

        lon, lat = get_centroid(geom)
        print(f"[{i+1:3d}/{len(features)}] centroid ({lon:.5f}, {lat:.5f}) ...", end=" ")

        node = reverse_geocode(lon, lat)
        props["node"] = node
        print(node or "—")

        # Be polite to Nominatim
        time.sleep(SLEEP_SECONDS)

    # Write result
    print(f"\nWriting {OUTPUT_GEOJSON} ...")
    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    print("Done.")


if __name__ == "__main__":
    main()