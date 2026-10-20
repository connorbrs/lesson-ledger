import { db } from './db';

/** One stored receipt photo as bytes plus its pixel size, for the PDF. Reads the row with one get, then the Blob after the read has finished. */
export async function loadReceiptPhoto(photoId: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const row = await db.attachments.get(photoId);
  if (!row) throw new Error('Receipt photo not found');
  const bytes = new Uint8Array(await row.blob.arrayBuffer());
  return { bytes, width: row.width, height: row.height };
}
