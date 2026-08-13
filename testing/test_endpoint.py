import random
from pathlib import Path

import requests


API_URL = "http://127.0.0.1:8000/detect"
IMAGE_DIR = Path(__file__).parent / "images"

SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
}


def get_random_image():
    images = [
        image
        for image in IMAGE_DIR.iterdir()
        if image.is_file() and image.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not images:
        raise FileNotFoundError(
            f"No images found in {IMAGE_DIR}"
        )

    return random.choice(images)


def send_image(image_path):
    with open(image_path, "rb") as image:
        response = requests.post(
            API_URL,
            files={
                "file": (
                    image_path.name,
                    image,
                    "image/jpeg"
                )
            }
        )

    return response


def main():
    try:
        image_path = get_random_image()

        print(f"Selected image: {image_path.name}")
        print(f"Sending to: {API_URL}")

        response = send_image(image_path)

        print(f"\nStatus code: {response.status_code}")
        print("Response:")

        try:
            print(response.json())
        except ValueError:
            print(response.text)

    except requests.exceptions.ConnectionError:
        print("Could not connect to the FastAPI server.")
        print("Make sure it is running with:")
        print("uvicorn backend.main:app --reload")

    except FileNotFoundError as e:
        print(e)


if __name__ == "__main__":
    main()