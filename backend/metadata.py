from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS


def extract_gps(image_path: str):
    """
    Extract latitude and longitude from image EXIF metadata.

    Returns:
        {
            "latitude": float,
            "longitude": float
        }

    or None if GPS metadata is unavailable.
    """

    image = Image.open(image_path)

    exif = image.getexif()

    if not exif:
        return None

    gps_info = None

    for tag_id, value in exif.items():
        tag = TAGS.get(tag_id, tag_id)

        if tag == "GPSInfo":
            gps_info = value
            break

    if not gps_info:
        return None

    gps_data = {}

    for key, value in gps_info.items():
        tag = GPSTAGS.get(key, key)
        gps_data[tag] = value

    if "GPSLatitude" not in gps_data or "GPSLongitude" not in gps_data:
        return None

    latitude = _convert_to_decimal(gps_data["GPSLatitude"])
    longitude = _convert_to_decimal(gps_data["GPSLongitude"])

    if gps_data.get("GPSLatitudeRef") == "S":
        latitude = -latitude

    if gps_data.get("GPSLongitudeRef") == "W":
        longitude = -longitude

    return {
        "latitude": latitude,
        "longitude": longitude
    }


def _convert_to_decimal(coordinate):
    """
    Convert GPS coordinates from:
        degrees, minutes, seconds

    to decimal degrees.
    """

    degrees = float(coordinate[0])
    minutes = float(coordinate[1])
    seconds = float(coordinate[2])

    return degrees + minutes / 60 + seconds / 3600