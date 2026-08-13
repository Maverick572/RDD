from pathlib import Path
from fastapi import UploadFile


UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def save_upload(file: UploadFile):
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            buffer.write(chunk)

    return str(file_path)