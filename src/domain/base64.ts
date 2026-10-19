/** Strict standard base64 (RFC 4648, padded) for backup photos. Uses only the btoa and atob globals. */

const CHUNK = 0x8000;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

/** True for a non-empty string whose length is a multiple of 4 and that has only base64 characters and at most two trailing '='. */
export function isBase64(text: unknown): text is string {
  return typeof text === 'string' && text.length > 0 && text.length % 4 === 0 && BASE64.test(text);
}

/** The number of bytes a valid base64 string decodes to (from its length and padding). */
export function base64DecodedLength(text: string): number {
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  return (text.length / 4) * 3 - pad;
}

/** Null unless the text is strict base64. */
export function base64ToBytes(text: unknown): Uint8Array | null {
  if (!isBase64(text)) return null;
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    return null;
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
