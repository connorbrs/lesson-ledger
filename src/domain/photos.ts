/** Receipt photo rules: constants, resize math, JPEG check and failure captions. Pure; no browser APIs. */

/** The stored photo's long edge in pixels. */
export const MAX_LONG_EDGE = 1600;
/** JPEG quality asked of the canvas encoder. */
export const JPEG_QUALITY = 0.8;
/** A picked file larger than this is refused before it is decoded (25 MB). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** A decoded image with more pixels than this is refused (50 megapixels). */
export const MAX_SOURCE_PIXELS = 50_000_000;
/** A re-encoded photo larger than this is refused (10 MB). */
export const MAX_STORED_PHOTO_BYTES = 10 * 1024 * 1024;
/** Sanity bound on a stored photo's width or height; the backup validator reuses it. */
export const MAX_PHOTO_DIMENSION = 100_000;

const isSize = (n: number) => Number.isInteger(n) && n >= 1;

/** The size that fits the long edge to maxLong. Never upscales, keeps the aspect, never gives a side below 1. Null for an invalid size. */
export function fitLongEdge(w: number, h: number, maxLong: number = MAX_LONG_EDGE): { w: number; h: number } | null {
  if (!isSize(w) || !isSize(h)) return null;
  const long = Math.max(w, h);
  if (long <= maxLong) return { w, h };
  const scale = maxLong / long;
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** True when the bytes start with the JPEG signature FF D8 FF. */
export function hasJpegMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

const TOO_LARGE = 'This photo is too large to add. Choose a smaller photo.';

/** One caption for a batch, or null when nothing failed. */
export function photoFailureCaption(failures: { tooLarge: number; unreadable: number }): string | null {
  const parts: string[] = [];
  if (failures.tooLarge > 0) parts.push(TOO_LARGE);
  if (failures.unreadable === 1) parts.push("This photo couldn't be read and wasn't added. Choose it again or take a new photo.");
  else if (failures.unreadable > 1) {
    parts.push(`${failures.unreadable} photos couldn't be read and weren't added. Choose them again or take new photos.`);
  }
  return parts.length === 0 ? null : parts.join(' ');
}
