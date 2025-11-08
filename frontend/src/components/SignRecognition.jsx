import { useState, useCallback, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useSignRecognition } from '../hooks/useSignRecognition';
import CameraFeed from './CameraFeed';
import './SignRecognition.css';

export default function SignRecognition({ targetSign = null, onCorrect = null }) {
  const { videoRef, startCamera, stopCamera, isActive, error: cameraError } = useCamera();
  const { prediction, confidence, isProcessing, error: recognitionError, predictSign, reset } = useSignRecognition();
  const [isCorrect, setIsCorrect] = useState(false);
  const [latestPayload, setLatestPayload] = useState(null);
  const [attemptResult, setAttemptResult] = useState(null);
  const [attemptError, setAttemptError] = useState(null);
  const [isScoring, setIsScoring] = useState(false);

  // Check if prediction matches target sign
  useEffect(() => {
    if (targetSign && prediction) {
      const matches = prediction.toUpperCase() === targetSign.toUpperCase();
      setIsCorrect(matches);
      if (matches && onCorrect) {
        onCorrect();
      }
    } else {
      setIsCorrect(false);
    }
  }, [prediction, targetSign, onCorrect]);

  const handleLandmarksDetected = useCallback((data) => {
    // data: { landmarks, handedness, imageSize, timestamp }
    if (!data || !data.landmarks) return;
    const { landmarks, handedness, imageSize, timestamp } = data;
    setLatestPayload(data);
    if (landmarks && landmarks.length === 21) {
      // Pass the meta info along to predictSign
      predictSign(landmarks, { handedness, imageSize, timestamp });
    }
  }, [predictSign]);

  const handleStart = () => {
    reset();
    setIsCorrect(false);
    setAttemptResult(null);
    startCamera();
  };

  const handleStop = () => {
    stopCamera();
    reset();
    setIsCorrect(false);
    setAttemptResult(null);
  };

  // Score a single-frame attempt against /api/attempts using the current targetSign
  const evaluateAttempt = async () => {
    setAttemptError(null);
    setAttemptResult(null);

    if (!targetSign) {
      setAttemptError('No target sign selected.');
      return;
    }
    if (!latestPayload || !latestPayload.landmarks) {
      setAttemptError('No landmarks available to score.');
      return;
    }

    const frame = {
      landmarks: latestPayload.landmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z || 0,
        v: lm.v !== undefined ? lm.v : 1.0
      }))
    };

    const body = {
      word: targetSign,
      frames: [frame]
    };

    setIsScoring(true);
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setAttemptResult(data);
    } catch (err) {
      setAttemptError(err.message || String(err));
      console.error('Error evaluating attempt:', err);
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <div className="sign-recognition">
      <div className="camera-container">
        {isActive ? (
          <CameraFeed
            videoRef={videoRef}
            onLandmarksDetected={handleLandmarksDetected}
            isActive={isActive}
          />
        ) : (
          <div className="camera-placeholder">
            <p>Click "Start Camera" to begin</p>
          </div>
        )}
      </div>

      <div className="controls">
        {!isActive ? (
          <button onClick={handleStart} className="btn btn-start">
            Start Camera
          </button>
        ) : (
          <button onClick={handleStop} className="btn btn-stop">
            Stop Camera
          </button>
        )}
      </div>

      <div className="results">
        {cameraError && (
          <div className="error">
            <p>Camera Error: {cameraError}</p>
          </div>
        )}

        {recognitionError && (
          <div className="error">
            <p>Recognition Error: {recognitionError}</p>
          </div>
        )}

        {isProcessing && (
          <div className="processing">
            <p>Processing...</p>
          </div>
        )}

        {prediction && (
          <div className={`prediction ${isCorrect ? 'correct' : ''}`}>
            <div className="prediction-sign">
              <h2>{prediction}</h2>
            </div>
            <div className="prediction-confidence">
              <p>Confidence: {(confidence * 100).toFixed(1)}%</p>
            </div>
            {targetSign && (
              <div className="target-sign">
                <p>Target: {targetSign}</p>
                {isCorrect && (
                  <div className="correct-indicator">
                    ✓ Correct!
                  </div>
                )}
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="btn btn-score"
                    onClick={evaluateAttempt}
                    disabled={isScoring}
                  >
                    {isScoring ? 'Scoring...' : 'Score Attempt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {attemptError && (
          <div className="error">
            <p>Scoring Error: {attemptError}</p>
          </div>
        )}

        {attemptResult && (
          <div className="attempt-result">
            <h3>Score: {attemptResult.score} / 100</h3>
            <p>{attemptResult.passed ? 'Passed' : 'Not passed yet'}</p>
            {attemptResult.tips && attemptResult.tips.length > 0 && (
              <div className="tips">
                <h4>Tips</h4>
                <ul>
                  {attemptResult.tips.map((tip, idx) => <li key={idx}>{tip}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {!prediction && !isProcessing && isActive && (
          <div className="waiting">
            <p>Show your hand to the camera</p>
          </div>
        )}
      </div>
    </div>
  );
}