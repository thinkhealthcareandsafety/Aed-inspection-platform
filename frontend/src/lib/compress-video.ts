/**
 * A large video from the phone's own camera app, made small before upload.
 *
 * Only for the fallback path — the in-app camera already records small. A
 * 15 s 4K clip is 30-150 MB: a minute or more to send on a mobile signal.
 * Played once into a 640 px canvas and re-recorded, it is ~3 MB, which the
 * server sees no difference in: it works at 640 px itself.
 *
 * It takes as long as the clip plays, so it is used only where that beats
 * sending the file as it is. Anything that goes wrong returns the original,
 * which the server accepts (up to 250 MB) and shrinks itself.
 */
import { RECORDING_BITRATE, recorderMimeType, recordingFile } from './camera-recorder';

/** Below this, the file goes as it is: sending it is quicker than shrinking it. */
export const COMPRESS_ABOVE_BYTES = 40 * 1024 * 1024;
const LONG_EDGE = 640;
/** No more of a long clip is kept than the server would scan anyway. */
const MAX_SECONDS = 30;

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
};

function canCompress(): boolean {
  if (typeof window === 'undefined' || typeof window.MediaRecorder !== 'function') return false;
  const canvas = document.createElement('canvas') as HTMLCanvasElement & { captureStream?: unknown };
  return typeof canvas.captureStream === 'function' && Boolean(recorderMimeType());
}

export async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (!file.type.startsWith('video/') || file.size <= COMPRESS_ABOVE_BYTES || !canCompress()) return file;
  try {
    const small = await reencode(file, onProgress);
    return small.size > 0 && small.size < file.size ? small : file;
  } catch {
    return file;
  }
}

async function reencode(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video') as FrameCallbackVideo;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  // Off screen but in the page: some phones decode nothing for a detached video.
  video.style.cssText = 'position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('metadata timeout')), 10_000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('cannot play'));
      };
    });
    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) throw new Error('no picture');
    const scale = Math.min(1, LONG_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas') as HTMLCanvasElement & {
      captureStream: (fps?: number) => MediaStream;
    };
    canvas.width = Math.max(2, Math.round((w * scale) / 2) * 2);
    canvas.height = Math.max(2, Math.round((h * scale) / 2) * 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');

    const mimeType = recorderMimeType()!;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: RECORDING_BITRATE });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(video.duration, MAX_SECONDS) : MAX_SECONDS;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
    };
    const draw = () => {
      if (done) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress?.(Math.min(1, video.currentTime / duration));
      if (video.currentTime >= duration) {
        finish();
        return;
      }
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw);
      else requestAnimationFrame(draw);
    };
    video.onended = finish;
    const guard = window.setTimeout(finish, duration * 1000 + 15_000);

    recorder.start(500);
    await video.play();
    draw();
    await stopped;
    window.clearTimeout(guard);
    stream.getTracks().forEach((t) => t.stop());
    return recordingFile(chunks, mimeType);
  } finally {
    video.remove();
    URL.revokeObjectURL(url);
  }
}
