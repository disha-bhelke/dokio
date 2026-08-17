import React, { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "./CameraCapture.css";

const dataUrlToFile = async (
  dataUrl,
  fileName
) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return new File(
    [blob],
    fileName,
    {
      type: blob.type || "image/jpeg",
    }
  );
};

const requestScanPreview = async ({
  imageDataUrl,
  corners = null,
  blackAndWhite = false,
}) => {
  const file = await dataUrlToFile(
    imageDataUrl,
    "camera-capture.jpg"
  );

  const formData = new FormData();
  formData.append("image", file);

  if (corners) {
    formData.append(
      "corners",
      JSON.stringify(corners)
    );
  }

  formData.append(
    "blackAndWhite",
    String(blackAndWhite)
  );

  const response = await api.post(
    "/documents/scan",
    formData,
    {
      headers: {
        "Content-Type":
          "multipart/form-data",
      },
    }
  );

  return response.data;
};

const getContainMetrics = (
  containerRect,
  naturalWidth,
  naturalHeight
) => {
  const containerRatio =
    containerRect.width /
    containerRect.height;
  const imageRatio =
    naturalWidth / naturalHeight;

  if (imageRatio > containerRatio) {
    const displayWidth = containerRect.width;
    const displayHeight =
      containerRect.width / imageRatio;

    return {
      displayWidth,
      displayHeight,
      offsetX: 0,
      offsetY:
        (containerRect.height - displayHeight) /
        2,
    };
  }

  const displayHeight = containerRect.height;
  const displayWidth =
    containerRect.height * imageRatio;

  return {
    displayWidth,
    displayHeight,
    offsetX:
      (containerRect.width - displayWidth) / 2,
    offsetY: 0,
  };
};

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

const CameraCapture = ({ onClose, onCapture }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const processingRequestRef = useRef(0);
  const skipNextPreviewEffectRef = useRef(false);

  const [step, setStep] = useState("camera");
  const [capturedImage, setCapturedImage] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [corners, setCorners] = useState(null);
  const [scannedImage, setScannedImage] = useState(null);
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  const [previewLayout, setPreviewLayout] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
          audio: false,
        });

        if (!mounted) return;

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error(err);
        setError("Unable to access camera. Please allow camera permission.");
      }
    };

    startCamera();

    return () => {
      mounted = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const processCapturedImage = async (
    imageDataUrl,
    {
      corners: nextCorners = null,
      blackAndWhite: nextBlackAndWhite = false,
      skipFollowUpEffect = false,
    } = {}
  ) => {
    const requestId = ++processingRequestRef.current;

    if (skipFollowUpEffect) {
      skipNextPreviewEffectRef.current = true;
    }

    setLoading(true);
    setError("");

    try {
      const result = await requestScanPreview({
        imageDataUrl,
        corners: nextCorners,
        blackAndWhite: nextBlackAndWhite,
      });

      if (requestId !== processingRequestRef.current) {
        return;
      }

      if (Array.isArray(result.corners)) {
        setCorners(result.corners);
      }

      if (result.previewDataUrl) {
        setScannedImage(result.previewDataUrl);
      }
    } catch (err) {
      console.error("Scan processing error:", err);
      setError("Could not process document scan.");
    } finally {
      if (requestId === processingRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.95);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setCapturedImage(image);
    setImageSize({
      width: canvas.width,
      height: canvas.height,
    });
    setStep("review");
    setBlackAndWhite(false);
    setScannedImage(null);
    setCorners(null);
    setError("");

    processCapturedImage(image, {
      corners: null,
      blackAndWhite: false,
      skipFollowUpEffect: true,
    });
  };

  useEffect(() => {
    if (step !== "review" || !capturedImage || !corners) {
      return;
    }

    if (skipNextPreviewEffectRef.current) {
      skipNextPreviewEffectRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      processCapturedImage(capturedImage, {
        corners,
        blackAndWhite,
      });
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [capturedImage, corners, blackAndWhite, step]);

  useEffect(() => {
    if (step !== "review") {
      setPreviewLayout(null);
      return;
    }

    const updateLayout = () => {
      const container = previewRef.current;

      if (!container || !imageSize) {
        setPreviewLayout(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const metrics = getContainMetrics(
        containerRect,
        imageSize.width,
        imageSize.height
      );

      setPreviewLayout({
        left: metrics.offsetX,
        top: metrics.offsetY,
        width: metrics.displayWidth,
        height: metrics.displayHeight,
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);

    return () => {
      window.removeEventListener("resize", updateLayout);
    };
  }, [step, imageSize]);

  const getImageCoordinates = (event) => {
    const container = previewRef.current;

    if (!container || !imageSize) return null;

    const rect = container.getBoundingClientRect();
    const metrics = getContainMetrics(
      rect,
      imageSize.width,
      imageSize.height
    );

    const x = event.clientX - rect.left - metrics.offsetX;
    const y = event.clientY - rect.top - metrics.offsetY;

    if (
      x < 0 ||
      y < 0 ||
      x > metrics.displayWidth ||
      y > metrics.displayHeight
    ) {
      return null;
    }

    return {
      x: (x / metrics.displayWidth) * imageSize.width,
      y: (y / metrics.displayHeight) * imageSize.height,
    };
  };

  const startDragging = (event, index) => {
    event.preventDefault();
    setDraggingIndex(index);
  };

  useEffect(() => {
    if (draggingIndex === null) {
      return;
    }

    const move = (event) => {
      const point = getImageCoordinates(event);

      if (!point) return;

      setCorners((prev) => {
        if (!prev) return prev;

        return prev.map((corner, index) =>
          index === draggingIndex ? point : corner
        );
      });
    };

    const stop = () => {
      setDraggingIndex(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [draggingIndex]);

  const retake = () => {
    setCapturedImage(null);
    setImageSize(null);
    setCorners(null);
    setScannedImage(null);
    setBlackAndWhite(false);
    setError("");
    setStep("camera");
    setDraggingIndex(null);
    skipNextPreviewEffectRef.current = false;
    processingRequestRef.current += 1;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
        },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(() => {
        setError("Unable to access camera.");
      });
  };

  const saveDocument = async () => {
    if (!scannedImage) return;

    const file = await dataUrlToFile(
      scannedImage,
      "scanned-document.jpg"
    );

    onCapture(file);
  };

  const previewWidth = imageSize?.width || 0;
  const previewHeight = imageSize?.height || 0;
  const handleRadius =
    Math.max(previewWidth, previewHeight) * 0.018;

  const insetHandlePoint = (point) => {
    if (!imageSize) return point;

    return {
      x: clamp(point.x, handleRadius, imageSize.width - handleRadius),
      y: clamp(point.y, handleRadius, imageSize.height - handleRadius),
    };
  };

  return (
    <div className="camera-modal">
      {step === "camera" && (
        <div className="camera-screen">
          <video
            ref={videoRef}
            className="camera-video"
            autoPlay
            playsInline
            muted
          />

          <div className="camera-controls">
            <button className="camera-cancel" onClick={onClose}>
              Cancel
            </button>

            <button className="capture-button" onClick={takePhoto}>
              <span />
            </button>
          </div>

          {error && <div className="camera-error">{error}</div>}
        </div>
      )}

      {step === "review" && (
        <div className="review-screen">
          <div className="review-header">
            <h2>Adjust and scan</h2>
            <p>
              Drag the four corners to fit the document, then choose color or black and white before saving.
            </p>
          </div>

          <div className="document-preview" ref={previewRef}>
            <img
              src={capturedImage}
              alt="Captured document"
              className="review-image"
              style={
                previewLayout
                  ? {
                      left: previewLayout.left,
                      top: previewLayout.top,
                      width: previewLayout.width,
                      height: previewLayout.height,
                    }
                  : undefined
              }
            />

            {corners && imageSize && (
              <svg
                className="corner-overlay"
                style={
                  previewLayout
                    ? {
                        left: previewLayout.left,
                        top: previewLayout.top,
                        width: previewLayout.width,
                        height: previewLayout.height,
                      }
                    : undefined
                }
                viewBox={`0 0 ${previewWidth} ${previewHeight}`}
                preserveAspectRatio="none"
              >
                <polygon
                  points={corners.map((point) => `${point.x},${point.y}`).join(" ")}
                  className="document-outline"
                />

                {corners.map((point, index) => (
                  <circle
                    key={index}
                    cx={insetHandlePoint(point).x}
                    cy={insetHandlePoint(point).y}
                    r={handleRadius}
                    className="corner-handle"
                    onPointerDown={(e) => startDragging(e, index)}
                  />
                ))}
              </svg>
            )}

            {loading && <div className="detecting">Detecting corners...</div>}
          </div>

          {error && <div className="camera-error">{error}</div>}

          {scannedImage && (
            <div className="scanned-preview">
              <h3>Preview</h3>
              <img src={scannedImage} alt="Scanned document" />
            </div>
          )}

          <div className="review-actions">
            <div className="scan-mode-toggle">
              <button
                type="button"
                className={`scan-mode-button ${!blackAndWhite ? "active" : ""}`}
                onClick={() => setBlackAndWhite(false)}
              >
                Color
              </button>

              <button
                type="button"
                className={`scan-mode-button ${blackAndWhite ? "active" : ""}`}
                onClick={() => setBlackAndWhite(true)}
              >
                B/W
              </button>
            </div>

            <button className="secondary-button" onClick={retake}>
              Retake
            </button>

            <button
              className="primary-button"
              onClick={saveDocument}
              disabled={!scannedImage || loading}
            >
              Save Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;