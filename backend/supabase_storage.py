import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

BUCKET_NAME = "road-images"

# Ensure the bucket exists and is public
try:
    existing = [b.name for b in supabase.storage.list_buckets()]
    if BUCKET_NAME not in existing:
        supabase.storage.create_bucket(BUCKET_NAME, options={"public": True})
    else:
        supabase.storage.update_bucket(BUCKET_NAME, options={"public": True})
except Exception as e:
    pass



def upload_image(image_path: str) -> str:
    # Use unique prefix to avoid key collisions while allowing upsert
    filename = Path(image_path).name
    storage_path = f"defects/{uuid.uuid4().hex[:8]}_{filename}"

    # Determine content-type
    ext = Path(image_path).suffix.lower()
    content_type = "image/png" if ext == ".png" else "image/jpeg"

    with open(image_path, "rb") as file:
        supabase.storage.from_(BUCKET_NAME).upload(
            storage_path,
            file,
            {
                "content-type": content_type,
                "upsert": "true"
            }
        )

    return supabase.storage.from_(BUCKET_NAME).get_public_url(
        storage_path
    )