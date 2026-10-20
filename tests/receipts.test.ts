import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { loadReceiptPhoto } from '../src/data/receipts';
import { JPEG_HEIGHT, JPEG_WIDTH, jpegBytes } from './fixtures/jpeg';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('loadReceiptPhoto', () => {
  it('returns the stored bytes with the stored pixel size', async () => {
    const bytes = jpegBytes();
    await db.attachments.put({
      id: 'p1',
      expenseId: 'e1',
      blob: new Blob([bytes.slice()], { type: 'image/jpeg' }),
      mime: 'image/jpeg',
      width: JPEG_WIDTH,
      height: JPEG_HEIGHT,
      createdAt: 1,
    });
    const photo = await loadReceiptPhoto('p1');
    expect(Array.from(photo.bytes)).toEqual(Array.from(bytes));
    expect(photo.width).toBe(JPEG_WIDTH);
    expect(photo.height).toBe(JPEG_HEIGHT);
  });

  it('rejects for an unknown id', async () => {
    await expect(loadReceiptPhoto('missing')).rejects.toThrow();
  });
});
