from fastapi import FastAPI, UploadFile, File

from backend.storage import save_upload
from backend.metadata import extract_gps
from backend.inference import detect_road_damage


app = FastAPI(
    title="Road Defect Detection API",
    description="API for road defect detection",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "Road Defect Detection API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)):

    image_path = await save_upload(file)

    location = extract_gps(image_path)

    detection = detect_road_damage(image_path)

    return {
        "filename": file.filename,
        "location": location,
        "detections": detection["detections"],
        "annotated_image": detection["image"]
    }