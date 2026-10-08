/**
 * The in-app camera for the readiness clip: the back camera at 720p,
 * recorded small (~2.5 Mbps — a 10 s clip is ~3 MB) by the browser itself.
 *
 * The phone's own camera app records whatever it is set to — 4K HDR on many
 * phones, 30-150 MB for 15 s — and gives no way to show where the light is.
 * Where the browser can't run a camera in the page (some in-app browsers,
 * old phones, a blocked permission), the caller falls back to the camera app.
 */

export type CameraFailure = 'blocked' | 'unavailable';

/** Whether this browser can run the camera and record inside the page. */
export function guidedCameraSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

/** The back camera, as close to 720p30 as the phone gives. */
export async function openBackCamera(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    },
    // A camera that refuses those numbers still films.
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      keepFocusing(stream);
      return stream;
    } catch (err) {
      last = err;
      // A refusal is the person's (or the browser's) answer: don't ask again.
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) throw err;
    }
  }
  throw last;
}

export function cameraFailureOf(err: unknown): CameraFailure {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
    ? 'blocked'
    : 'unavailable';
}

/** Continuous focus where the phone lets the page ask (Android Chrome). */
function keepFocusing(stream: MediaStream): void {
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[] };
  if (caps.focusMode?.includes('continuous')) {
    track
      .applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      .catch(() => undefined);
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** MP4 where the browser records it (Safari, recent Chrome), else WebM.
 *  The server converts either; MP4 also plays back on every phone. */
export function recorderMimeType(): string | undefined {
  const candidates = [
    'video/mp4;codecs=avc1.42E01F',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

/** Bits per second for the in-app clip: plenty for a small light at 720p. */
export const RECORDING_BITRATE = 2_500_000;

/** A finished recording as a File the upload takes, typed without codecs so
 *  the server files it under the right extension. */
export function recordingFile(chunks: Blob[], mimeType: string): File {
  const type = mimeType.split(';')[0] || 'video/webm';
  const ext = type === 'video/mp4' ? 'mp4' : 'webm';
  return new File(chunks, `readiness.${ext}`, { type });
}

/** Keeps the screen on while filming; released when the camera closes. */
export async function keepScreenOn(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    const lock = await nav.wakeLock?.request('screen');
    return () => {
      lock?.release().catch(() => undefined);
    };
  } catch {
    return () => undefined;
  }
}
