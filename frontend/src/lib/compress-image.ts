/**
 * Shrinks a captured photo before upload.
 *
 * AEDs live in stairwells, basements and back corridors — exactly where phone
 * signal is worst — while modern phone cameras produce 3-8MB files. Uploading
 * those raw is the single most likely thing to fail in the field. Re-encoding
 * to ~1600px/JPEG keeps every detail the AI needs (serial digits, expiry
 * dates) while typically cutting the payload by 80-90%.
 *
 * Every failure path returns the original file: a compression problem must
 * never cost an inspector their capture.
 */

/** Long edge, in px. Comfortably above what's needed to OCR a serial number. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
/** Below this, re-encoding costs more than it saves. */
const SKIP_BELOW_BYTES = 400 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= SKIP_BELOW_BYTES) return file;

  try {
    // `imageOrientation: 'from-image'` applies the EXIF rotation flag. Without
    // it, portrait phone photos land sideways on the canvas — and a rotated
    // label is materially harder for the AI to read.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
