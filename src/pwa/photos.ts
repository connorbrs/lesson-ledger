import {
  fitLongEdge,
  hasJpegMagic,
  JPEG_QUALITY,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_PIXELS,
  MAX_STORED_PHOTO_BYTES,
} from '../domain/photos';

export type PhotoErrorCode = 'too-large' | 'unreadable';

export class PhotoError extends Error {
  constructor(readonly code: PhotoErrorCode) {
    super(code);
    this.name = 'PhotoError';
  }
}

/** A decoded picture. `release` frees whatever the decode holds; the pipeline calls it exactly once. */
export interface DecodedImage {
  width: number;
  height: number;
  source: unknown;
  release(): void;
}

/** The browser objects the pipeline needs, injected so tests can pass fakes. */
export interface PhotoEnv {
  decode(file: Blob): Promise<DecodedImage>;
  /** Draws the image at width x height and encodes a JPEG; null when the platform cannot. */
  encode(image: DecodedImage, width: number, height: number): Promise<Blob | null>;
}

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Orientation relies on the Image path honoring EXIF. If the device check shows sideways photos, decode
 * through createImageBitmap(file, { imageOrientation: 'from-image' }) here instead; callers do not change.
 */
export function defaultPhotoEnv(): PhotoEnv {
  return {
    async decode(file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const release = () => {
        img.src = '';
        URL.revokeObjectURL(url);
      };
      try {
        img.src = url;
        await img.decode();
      } catch (e) {
        release();
        throw e;
      }
      return { width: img.naturalWidth, height: img.naturalHeight, source: img, release };
    },
    async encode(image, width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(image.source as CanvasImageSource, 0, 0, width, height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
  };
}

/**
 * Turns one picked file into a small JPEG. Everything finishes here, before any database transaction opens.
 * Throws PhotoError. The decode is released on every path that decoded.
 */
export async function prepareReceipt(file: Blob, env: PhotoEnv = defaultPhotoEnv()): Promise<PreparedPhoto> {
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError('too-large');
  let image: DecodedImage;
  try {
    image = await env.decode(file);
  } catch {
    throw new PhotoError('unreadable');
  }
  try {
    if (image.width * image.height > MAX_SOURCE_PIXELS) throw new PhotoError('too-large');
    const fit = fitLongEdge(image.width, image.height);
    if (!fit) throw new PhotoError('unreadable');
    let blob: Blob | null;
    try {
      blob = await env.encode(image, fit.w, fit.h);
    } catch {
      throw new PhotoError('unreadable');
    }
    if (!blob || blob.type !== 'image/jpeg' || blob.size === 0) throw new PhotoError('unreadable');
    if (blob.size > MAX_STORED_PHOTO_BYTES) throw new PhotoError('too-large');
    let head: Uint8Array;
    try {
      head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    } catch {
      throw new PhotoError('unreadable');
    }
    if (!hasJpegMagic(head)) throw new PhotoError('unreadable');
    return { blob, width: fit.w, height: fit.h };
  } finally {
    image.release();
  }
}

/**
 * Processes files strictly one at a time, in order. A failure is reported and the rest continue.
 * Once isCancelled() is true nothing more is processed or reported.
 */
export async function prepareReceipts(
  files: readonly Blob[],
  handlers: { onPhoto: (photo: PreparedPhoto) => void; onFailure: (code: PhotoErrorCode) => void; isCancelled?: () => boolean },
  env: PhotoEnv = defaultPhotoEnv(),
): Promise<void> {
  const cancelled = () => handlers.isCancelled?.() === true;
  for (const file of files) {
    if (cancelled()) return;
    let photo: PreparedPhoto | null = null;
    let failure: PhotoErrorCode | null = null;
    try {
      photo = await prepareReceipt(file, env);
    } catch (e) {
      failure = e instanceof PhotoError ? e.code : 'unreadable';
    }
    if (cancelled()) return;
    if (photo) handlers.onPhoto(photo);
    else if (failure) handlers.onFailure(failure);
  }
}
