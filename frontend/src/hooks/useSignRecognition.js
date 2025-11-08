import { useState, useCallback, useRef } from 'react';

const API_URL = 'http://localhost:8000/api/sign-language/predict';

export function useSignRecognition() {
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const frameCountRef = useRef(0);
  const lastRequestTimeRef = useRef(0);

  // Throttle requests to avoid overwhelming the backend
  const THROTTLE_MS = 100; // Process every ~100ms (10fps)
  const FRAME_SKIP = 3; // Process every 3rd frame

  // landmarks: array of {x,y,z,v}
  // meta: { handedness, imageSize: {width, height}, timestamp }
  const predictSign = useCallback(async (landmarks, meta = {}) => {
    // Skip frames to reduce API calls
    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) {
      return;
    }

    // Throttle by time
    const now = Date.now();
    if (now - lastRequestTimeRef.current < THROTTLE_MS) {
      return;
    }
    lastRequestTimeRef.current = now;

    if (!landmarks || landmarks.length !== 21) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Build flattened landmarks for easier backend ingestion
      const landmarks_flat = landmarks.flatMap(lm => [lm.x, lm.y, lm.z || 0]);

      const body = {
        frame_id: `${Date.now()}`,
        timestamp: meta.timestamp || Date.now(),
        image_size: meta.imageSize || { width: 640, height: 480 },
        handedness: meta.handedness || 'Unknown',
        hand_landmarks: {
          landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 })),
          landmarks_flat
        }
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Expect backend to return { predicted_sign: "A", confidence: 0.92 }
      setPrediction(data.predicted_sign);
      setConfidence(data.confidence);
    } catch (err) {
      setError(err.message);
      console.error('Error predicting sign:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPrediction(null);
    setConfidence(0);
    setError(null);
    frameCountRef.current = 0;
  }, []);

  return {
    prediction,
    confidence,
    isProcessing,
    error,
    predictSign,
    reset
  };
}