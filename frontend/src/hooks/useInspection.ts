'use client';

import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useInspectionStore } from '@/stores/inspection-store';
import { useAuthStore } from '@/stores/auth-store';
import type { StateUpdate } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

// How often to send frames to the server (ms). 100ms = ~10 fps.
const FRAME_INTERVAL_MS = 100;

export function useInspection() {
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { token } = useAuthStore();
  const {
    inspectionId,
    sessionId,
    isStreaming,
    applyStateUpdate,
    setConnected,
    setCameraActive,
    setStreaming,
    setError,
    setIds,
    reset,
  } = useInspectionStore();

  // ── Connect Socket.IO ──────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setStreaming(false);
    });

    socket.on('state_update', (update: StateUpdate) => {
      applyStateUpdate(update);
    });

    socket.on('inspection_complete', (update: StateUpdate) => {
      applyStateUpdate({ ...update, type: 'inspection_complete' });
      stopStreaming();
      toast.success('Inspection complete! Report is ready.');
    });

    socket.on('inspection_ready', () => {
      startFrameStream();
    });

    socket.on('cv_error', ({ message }: { message: string }) => {
      setError(message);
      toast.error(`CV Error: ${message}`);
    });

    socket.on('cv_disconnected', () => {
      toast.warning('CV service disconnected');
      setStreaming(false);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      toast.error(`Connection error: ${err.message}`);
    });

    socketRef.current = socket;
  }, [token, applyStateUpdate, setConnected, setStreaming, setError]);

  // ── Open camera ───────────────────────────────────────────────────────────
  const openCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment', // rear camera on mobile
          frameRate: { ideal: 15 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      setError(msg);
      toast.error(`Camera: ${msg}`);
    }
  }, [setCameraActive, setError]);

  // ── Start frame streaming ──────────────────────────────────────────────────
  const startFrameStream = useCallback(() => {
    if (!socketRef.current || !videoRef.current || !canvasRef.current) return;
    if (isStreaming) return;

    setStreaming(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    frameIntervalRef.current = setInterval(() => {
      if (video.readyState !== 4) return; // HAVE_ENOUGH_DATA

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob || !socketRef.current?.connected) return;
          blob.arrayBuffer().then((buf) => {
            socketRef.current?.emit('video_frame', buf);
          });
        },
        'image/jpeg',
        0.80, // JPEG quality — balance quality vs bandwidth
      );
    }, FRAME_INTERVAL_MS);
  }, [isStreaming, setStreaming]);

  const stopStreaming = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setStreaming(false);
  }, [setStreaming]);

  // ── Start inspection ───────────────────────────────────────────────────────
  const startInspection = useCallback(
    async (inspId: string, sessId: string) => {
      setIds(inspId, sessId);
      connect();

      // Small delay so socket connects before emitting
      setTimeout(() => {
        socketRef.current?.emit('start_inspection', {
          inspectionId: inspId,
          sessionId: sessId,
        });
      }, 800);
    },
    [connect, setIds],
  );

  // ── Stop inspection ────────────────────────────────────────────────────────
  const stopInspection = useCallback(() => {
    stopStreaming();
    socketRef.current?.emit('stop_inspection');
    socketRef.current?.disconnect();

    // Stop camera tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setConnected(false);
  }, [stopStreaming, setCameraActive, setConnected]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopInspection();
      reset();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videoRef,
    canvasRef,
    openCamera,
    startInspection,
    stopInspection,
    stopStreaming,
  };
}
