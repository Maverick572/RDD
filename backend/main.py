import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.detect import router as detect_router
from backend.find_nearest import router as nearest_router
from backend.ward_defects import router as ward_defects_router
from backend.ward_roads import router as ward_roads_router
from backend.dashboard import router as dashboard_router
from backend.schedule_maintenance import router as schedule_maintenance_router
from backend.complete_maintenance import router as complete_maintenance_router
from backend.update_maintenance import router as update_maintenance_router
from backend.maintenance_records import router as maintenance_records_router

load_dotenv()

app = FastAPI(
    title="Road Defect Detection API",
    description="API for road defect detection",
    version="1.0.0"
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure outputs and uploads directories exist for static serving
os.makedirs("outputs", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


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


# Include modular routers
app.include_router(detect_router)
app.include_router(nearest_router)
app.include_router(ward_defects_router)
app.include_router(ward_roads_router)
app.include_router(dashboard_router)
app.include_router(schedule_maintenance_router)
app.include_router(complete_maintenance_router)
app.include_router(update_maintenance_router)
app.include_router(maintenance_records_router)