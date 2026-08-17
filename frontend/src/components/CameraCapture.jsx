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

const CameraCapture = ({ onClose, onCapture, initialFile = null }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const processingRequestRef = useRef(0);

  const [step, setStep] = useState("camera"); // "camera" | "corners" | "preview"
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
    if (initialFile) {
      let active = true;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!active) return;
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          if (!active) return;
          setCapturedImage(dataUrl);
          setImageSize({
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          });
          setStep("corners");
          setBlackAndWhite(false);
          setScannedImage(null);
          setCorners(null);
          setError("");

          processCapturedImage(dataUrl, {
            corners: null,
            blackAndWhite: false,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(initialFile);

      return () => {
        active = false;
      };
    }

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
  }, [initialFile]);

  const processCapturedImage = async (
    imageDataUrl,
    {
      corners: nextCorners = null,
      blackAndWhite: nextBlackAndWhite = false,
    } = {}
  ) => {
    const requestId = ++processingRequestRef.current;

    setLoading(true);
    setError("");

    try {
      const result = await requestScanPreview({
        imageDataUrl,
        corners: nextCorners,
        blackAndWhite: nextBlackAndWhite,
      });

      if (requestId !== processingRequestRef.current) {
        return false;
      }

      if (Array.isArray(result.corners) && !nextCorners) {
        setCorners(result.corners);
      }

      if (result.previewDataUrl) {
        setScannedImage(result.previewDataUrl);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Scan processing error:", err);
      setError("Could not process document scan.");
      return false;
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
    setStep("corners");
    setBlackAndWhite(false);
    setScannedImage(null);
    setCorners(null);
    setError("");

    processCapturedImage(image, {
      corners: null,
      blackAndWhite: false,
    });
  };

  const handleConfirmCorners = async () => {
    if (!capturedImage || !corners || loading) return;
    const success = await processCapturedImage(capturedImage, {
      corners,
      blackAndWhite,
    });

    if (success) {
      setStep("preview");
    }
  };

  useEffect(() => {
    if (step !== "corners") {
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

    const rawX = event.clientX - rect.left - metrics.offsetX;
    const rawY = event.clientY - rect.top - metrics.offsetY;

    const clampedX = Math.max(0, Math.min(rawX, metrics.displayWidth));
    const clampedY = Math.max(0, Math.min(rawY, metrics.displayHeight));

    return {
      x: (clampedX / metrics.displayWidth) * imageSize.width,
      y: (clampedY / metrics.displayHeight) * imageSize.height,
    };
  };

  const startDragging = (event, index) => {
    event.preventDefault();
    if (event.target && event.target.setPointerCapture) {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (err) {
        // Fallback for environments without SVG pointer capture support
      }
    }
    setDraggingIndex(index);
  };

  useEffect(() => {
    if (draggingIndex === null) {
      return;
    }

    const move = (event) => {
      event.preventDefault();
      const point = getImageCoordinates(event);

      if (!point) return;

      setCorners((prev) => {
        if (!prev) return prev;

        return prev.map((corner, index) =>
          index === draggingIndex ? point : corner
        );
      });
    };

    const stop = (event) => {
      if (event && event.target && event.target.releasePointerCapture) {
        try {
          event.target.releasePointerCapture(event.pointerId);
        } catch (err) {
          // ignore
        }
      }
      setDraggingIndex(null);
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [draggingIndex]);

  const retake = () => {
    if (initialFile) {
      onClose();
      return;
    }

    setCapturedImage(null);
    setImageSize(null);
    setCorners(null);
    setScannedImage(null);
    setBlackAndWhite(false);
    setError("");
    setStep("camera");
    setDraggingIndex(null);
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

  const saveOriginal = async () => {
    if (!capturedImage) return;

    const file = await dataUrlToFile(
      capturedImage,
      initialFile?.name || "original-document.jpg"
    );

    onCapture(file);
  };

  const saveScanned = async () => {
    if (!scannedImage) return;

    const file = await dataUrlToFile(
      scannedImage,
      "scanned-document.jpg"
    );

    onCapture(file);
  };

  const previewWidth = imageSize?.width || 0;
  const previewHeight = imageSize?.height || 0;
  const handleRadius = Math.max(
    Math.max(previewWidth, previewHeight) * 0.024,
    18
  );

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

      {step === "corners" && (
        <div className="review-screen">
          <div className="review-header">
            <h2>Adjust Corners</h2>
            <p>
              Drag the four green corners to fit your document boundaries.
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

          <div className="review-actions">
            <button type="button" className="secondary-button" onClick={retake}>
              {initialFile ? "Cancel" : "Retake"}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={handleConfirmCorners}
              disabled={!corners || loading}
            >
              {loading ? "Generating Preview..." : "Confirm Corners"}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="review-screen">
          <div className="review-header">
            <h2>Document Preview</h2>
            <p>
              Choose color or black &amp; white mode, then save your document.
            </p>
          </div>

          {scannedImage && (
            <div className="scanned-preview">
              <img src={scannedImage} alt="Scanned document" />
            </div>
          )}

          {error && <div className="camera-error">{error}</div>}

          <div className="review-actions">
            <div className="scan-mode-toggle">
              <button
                type="button"
                className={`scan-mode-button ${!blackAndWhite ? "active" : ""}`}
                onClick={() => {
                  setBlackAndWhite(false);
                  processCapturedImage(capturedImage, { corners, blackAndWhite: false });
                }}
              >
                Color
              </button>

              <button
                type="button"
                className={`scan-mode-button ${blackAndWhite ? "active" : ""}`}
                onClick={() => {
                  setBlackAndWhite(true);
                  processCapturedImage(capturedImage, { corners, blackAndWhite: true });
                }}
              >
                B/W
              </button>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setStep("corners")}
            >
              Adjust Corners
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={saveScanned}
              disabled={!scannedImage || loading}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;