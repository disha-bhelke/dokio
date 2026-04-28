import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check } from 'lucide-react';
import './CameraCapture.css';

const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [originalPhotoData, setOriginalPhotoData] = useState(null);
  const [scannedPhotoData, setScannedPhotoData] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const original = canvas.toDataURL('image/jpeg', 0.9);
    applyScanFilter(ctx, canvas.width, canvas.height);
    const scanned = canvas.toDataURL('image/jpeg', 0.9);

    setOriginalPhotoData(original);
    setScannedPhotoData(scanned);

    // Stop stream to save battery / release camera while previewing
    stopCamera();
  };

  const applyScanFilter = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contrast = 1.5;
      const intercept = 128 * (1 - contrast);
      const color = avg * contrast + intercept;
      
      const finalColor = color > 255 ? 255 : (color < 0 ? 0 : color);
      
      data[i] = finalColor;
      data[i + 1] = finalColor;
      data[i + 2] = finalColor;
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  const handleRetake = () => {
    setOriginalPhotoData(null);
    setScannedPhotoData(null);
    startCamera();
  };

  const handleSave = async (dataUrl, filename) => {
    if (!dataUrl) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/jpeg' });
    onCapture(file);
  };

  return (
    <div className="camera-modal">
      <div className="camera-container">
        <button className="close-btn" onClick={onClose}><X size={"1.5rem"} /></button>

        {!originalPhotoData ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="camera-view" />
            <div className="camera-controls">
              <button className="capture-btn" onClick={takePhoto}>
                <Camera size={"2rem"} color="white" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="camera-preview-grid">
              <div className="camera-preview">
                <div className="camera-preview-label">Original</div>
                <img src={originalPhotoData} alt="Original capture" className="camera-preview-img" />
              </div>
              <div className="camera-preview">
                <div className="camera-preview-label">Scanned (B/W)</div>
                <img src={scannedPhotoData} alt="Scanned black and white" className="camera-preview-img" />
              </div>
            </div>
            <div className="camera-controls">
              <button className="control-btn" onClick={handleRetake}>Retake</button>
              <button
                className="control-btn"
                onClick={() => handleSave(originalPhotoData, 'capture-original.jpg')}
              >
                <Check size={"1.5rem"} /> Save Original
              </button>
              <button
                className="control-btn primary"
                onClick={() => handleSave(scannedPhotoData, 'capture-scanned.jpg')}
              >
                <Check size={"1.5rem"} /> Save Scanned
              </button>
            </div>
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default CameraCapture;
