import argparse
import base64
import json
import math
import sys

import cv2
import numpy as np


MAX_DETECTION_WIDTH = 1200
MIN_DOCUMENT_AREA_RATIO = 0.08


def order_points(points):
    pts = np.array(points, dtype="float32")
    rect = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def fallback_corners(width, height):
    return [
        {"x": 0, "y": 0},
        {"x": width, "y": 0},
        {"x": width, "y": height},
        {"x": 0, "y": height},
    ]


def normalize_corners(corners):
    ordered = order_points(corners)
    return [
        {"x": float(point[0]), "y": float(point[1])}
        for point in ordered
    ]


def corners_to_points(corners):
    points = []
    for corner in corners:
        if isinstance(corner, dict):
            points.append([float(corner["x"]), float(corner["y"])])
        else:
            points.append([float(corner[0]), float(corner[1])])
    return points


def detect_corners(image):
    original_height, original_width = image.shape[:2]

    scale = 1.0
    if original_width > MAX_DETECTION_WIDTH:
        scale = MAX_DETECTION_WIDTH / float(original_width)

    detection_width = int(round(original_width * scale))
    detection_height = int(round(original_height * scale))

    resized = cv2.resize(
        image,
        (detection_width, detection_height),
        interpolation=cv2.INTER_AREA,
    )

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 140)
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    min_area = detection_width * detection_height * MIN_DOCUMENT_AREA_RATIO
    best_quad = None
    best_area = 0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)

        if len(approx) == 4:
            corners = approx.reshape(4, 2).astype("float32")
            if scale != 1.0:
                corners /= scale
            if area > best_area:
                best_area = area
                best_quad = corners

    if best_quad is None:
        return fallback_corners(original_width, original_height)

    return normalize_corners(best_quad)


def warp_document(image, corners, black_and_white=False):
    corners = corners_to_points(corners)
    ordered = order_points(corners)

    top_left, top_right, bottom_right, bottom_left = ordered

    width_top = math.hypot(top_right[0] - top_left[0], top_right[1] - top_left[1])
    width_bottom = math.hypot(bottom_right[0] - bottom_left[0], bottom_right[1] - bottom_left[1])
    height_left = math.hypot(bottom_left[0] - top_left[0], bottom_left[1] - top_left[1])
    height_right = math.hypot(bottom_right[0] - top_right[0], bottom_right[1] - top_right[1])

    width = max(int(round(max(width_top, width_bottom))), 1)
    height = max(int(round(max(height_left, height_right))), 1)

    destination = np.array(
        [
            [0, 0],
            [width - 1, 0],
            [width - 1, height - 1],
            [0, height - 1],
        ],
        dtype="float32",
    )

    matrix = cv2.getPerspectiveTransform(ordered, destination)
    warped = cv2.warpPerspective(image, matrix, (width, height))

    if black_and_white:
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        gray = cv2.convertScaleAbs(gray, alpha=1.4, beta=0)
        warped = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    success, encoded = cv2.imencode(
        ".jpg",
        warped,
        [cv2.IMWRITE_JPEG_QUALITY, 92],
    )

    if not success:
        raise RuntimeError("Could not encode preview image")

    preview_bytes = encoded.tobytes()
    preview_base64 = base64.b64encode(preview_bytes).decode("ascii")

    return {
        "previewDataUrl": f"data:image/jpeg;base64,{preview_base64}",
        "previewWidth": width,
        "previewHeight": height,
    }


def parse_corners(raw_corners):
    if raw_corners is None:
        return None

    if isinstance(raw_corners, str):
        raw_corners = json.loads(raw_corners)

    if not isinstance(raw_corners, list) or len(raw_corners) != 4:
        raise ValueError("corners must be a list of four points")

    points = []
    for point in raw_corners:
        if not isinstance(point, dict):
            raise ValueError("corners must contain point objects")
        points.append([float(point["x"]), float(point["y"])])

    return points


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--corners")
    parser.add_argument("--black-and-white", action="store_true")
    args = parser.parse_args()

    image = cv2.imread(args.image)
    if image is None:
      raise RuntimeError("Could not read image")

    corners = parse_corners(args.corners)
    if corners is None:
        corners = detect_corners(image)
    else:
        corners = normalize_corners(corners)

    warped = warp_document(
        image,
        corners,
        black_and_white=args.black_and_white,
    )

    result = {
        "corners": corners,
        **warped,
    }

    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
