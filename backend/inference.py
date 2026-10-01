from pathlib import Path
import torch
from ultralytics import YOLO


MODEL_PATH = Path(__file__).parent.parent / "ai" / "models" / "best.pt"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"

# Only these classes are allowed through the pipeline
ALLOWED_CLASSES = {"D10", "D20", "D30", "D40"}

# Load model once when the application starts
model = YOLO(str(MODEL_PATH))


def detect_road_damage(image_path: str):
    """
    Run road-damage detection on an image.

    Only D10, D20, D30 and D40 detections are returned.

    Returns:
        {
            "detections": [...],
            "image": "path/to/annotated/image.jpg",
            "image_width": int,
            "image_height": int
        }
    """

    results = model.predict(
        source=image_path,
        conf=0.25,
        save=False
    )

    result = results[0]

    # Original image dimensions
    image_height, image_width = result.orig_shape

    detections = []

    for box in result.boxes:
        class_id = int(box.cls[0])
        class_name = model.names[class_id]

        # Ignore classes outside our required set
        if class_name not in ALLOWED_CLASSES:
            continue

        confidence = float(box.conf[0])

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detections.append({
            "class": class_name,
            "confidence": round(confidence, 3),
            "bbox": [
                round(x1, 2),
                round(y1, 2),
                round(x2, 2),
                round(y2, 2)
            ]
        })

    # Generate annotated image using ONLY allowed detections
    allowed_boxes = [
        box
        for box in result.boxes
        if model.names[int(box.cls[0])] in ALLOWED_CLASSES
    ]

    if allowed_boxes:
        # Plot only the filtered boxes
        from ultralytics.engine.results import Boxes

        filtered_boxes = Boxes(
            torch.cat(
                [box.data for box in allowed_boxes],
                dim=0
            ),
            result.orig_shape
        )

        result.boxes = filtered_boxes

    annotated_image = result.plot()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_path = OUTPUT_DIR / f"{Path(image_path).stem}_result.jpg"

    # OpenCV is used only for writing the generated image
    import cv2

    cv2.imwrite(str(output_path), annotated_image)

    return {
        "detections": detections,
        "image": str(output_path),
        "image_width": int(image_width),
        "image_height": int(image_height)
    }