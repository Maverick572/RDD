from pathlib import Path

from ultralytics import YOLO


MODEL_PATH = Path(__file__).parent.parent / "ai" / "models" / "best.pt"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"

# Load model once when the application starts
model = YOLO(str(MODEL_PATH))


def detect_road_damage(image_path: str):
    """
    Run road-damage detection on an image.

    Returns:
        {
            "detections": [...],
            "image": "path/to/annotated/image.jpg"
        }
    """

    results = model.predict(
        source=image_path,
        conf=0.25,
        save=False
    )

    result = results[0]

    detections = []

    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detections.append({
            "class": model.names[class_id],
            "confidence": round(confidence, 3),
            "bbox": [
                round(x1, 2),
                round(y1, 2),
                round(x2, 2),
                round(y2, 2)
            ]
        })

    # Generate annotated image
    annotated_image = result.plot()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_path = OUTPUT_DIR / f"{Path(image_path).stem}_result.jpg"

    # OpenCV is used only for writing the generated image
    import cv2

    cv2.imwrite(str(output_path), annotated_image)

    return {
        "detections": detections,
        "image": str(output_path)
    }