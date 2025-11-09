import { useState, useEffect, useRef } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Attach stream to video element when stream changes
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      // try to play; some browsers require play to be called on user gesture or after attach
      videoRef.current.play().catch((err) => {
        // try again shortly after in case element isn't ready
        setTimeout(() => {
          try {
            if (videoRef.current) videoRef.current.play().catch(() => {});
          } catch (e) {}
        }, 200);
      });
    }
    
    return () => {
      // Cleanup: stop all tracks when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError(err.message);
      console.error('Error accessing camera:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return {
    videoRef,
    stream,
    error,
    startCamera,
    stopCamera,
    isActive: stream !== null
  };
}

