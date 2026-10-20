import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PdfBuildError, type LoadPhoto } from '../src/domain/pdfContent';
import { buildSummaryPdf } from '../src/pdf/summaryPdf';
import type { Expense } from '../src/domain/types';
import { JPEG_HEIGHT, JPEG_WIDTH, jpegBytes } from './fixtures/jpeg';
import { drawnTexts, pdfRaw } from './fixtures/pdfText';
import { pdfTotalsLines } from '../src/domain/pdfContent';
import { noPhotos, trSession, trSummary } from './fixtures/pdfSummary';

const text = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};

describe('buildSummaryPdf (tracer)', () => {
  it('builds a one-page PDF that embeds the font', async () => {
    const built = await buildSummaryPdf(trSummary(), 'Connor B.', noPhotos);
    expect(built.blob.type).toBe('application/pdf');
    expect(built.pageCount).toBe(1);
    const raw = await text(built.blob);
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw).toContain('/FontFile2');
    expect(raw).toContain('/ToUnicode');
  });

  it('draws every Turkish letter and both dashes from the font (ToUnicode evidence)', async () => {
    const summary = trSummary({
      familyName: 'Şşğıİ ŞĞ çöü ÇÖÜ',
      names: { ava: 'Şule İpek Ğ' },
      sessions: [trSession({ id: 's1', date: '2026-10-12', subject: 'math', lessonMinutes: 60, activityMinutes: 30 })],
    });
    const built = await buildSummaryPdf(summary, 'Connor B.', noPhotos, { compress: false });
    const raw = (await text(built.blob)).toLowerCase();
    const map = raw.slice(raw.indexOf('begincmap'));
    expect(map).toContain('beginbfchar');
    for (const cp of ['015f', '011f', '0131', '0130', '015e', '011e', '00e7', '00f6', '00fc', '00c7', '00d6', '00dc', '2013', '2014']) {
      expect(map, cp).toMatch(new RegExp(`><${cp}>`));
    }
  });

  it('survives hostile text in names (T-04-14)', async () => {
    const summary = trSummary({ familyName: '<b>(Smith)\\</b>', names: { ava: '<script>)(\\' } });
    const built = await buildSummaryPdf(summary, '(x)\\', noPhotos);
    expect((await text(built.blob)).startsWith('%PDF-')).toBe(true);
  });
});

const goodPhoto: LoadPhoto = async () => ({ bytes: jpegBytes(), width: JPEG_WIDTH, height: JPEG_HEIGHT });

const exp = (i: number, over: Partial<Expense> = {}): Expense => ({
  id: `e${i}`,
  sessionId: 's1',
  description: `Expense ${i}`,
  amountCents: 1875,
  splits: [{ familyId: 'smith', cents: 1875 }],
  createdAt: i,
  updatedAt: 1,
  ...over,
});

const texts = async (built: { blob: Blob }) => drawnTexts(await pdfRaw(built.blob));

describe('buildSummaryPdf (complete)', () => {
  it('draws the expenses table and the expenses total when there are expenses but no photos', async () => {
    const summary = trSummary({ expenses: [exp(1)] });
    const built = await buildSummaryPdf(summary, 'Connor B.', noPhotos, { compress: false });
    expect(built.pageCount).toBe(1);
    const t = (await texts(built)).map((x) => x.text);
    expect(t).toContain('Masraflar');
    expect(t).toContain('Aile payı');
    expect(t).toContain('Expense 1');
    expect(t).toContain('Masraflar (aile payı) $18.75');
    expect(t).not.toContain('Fişler');
  });

  it('one expense with one photo gives a content page and a receipt page with caption and heading', async () => {
    const summary = trSummary({ expenses: [exp(1)], photos: { e1: ['p1'] } });
    const built = await buildSummaryPdf(summary, 'Connor B.', goodPhoto, { compress: false });
    expect(built.pageCount).toBe(2);
    const t = await texts(built);
    expect(t.filter((x) => x.text === 'Fişler')).toHaveLength(1);
    expect(t.find((x) => x.text === 'Fişler')?.page).toBe(2);
    expect(t.find((x) => x.text === 'Expense 1 — $18.75')?.page).toBe(2);
    const footers = t.filter((x) => x.size === 8).map((x) => x.text);
    expect(footers).toEqual(['Smith ailesi — 12–18 Ekim 2026 · Sayfa 1 / 2', 'Smith ailesi — 12–18 Ekim 2026 · Sayfa 2 / 2']);
  });

  it('three photos give a content page and two receipt pages, numbered captions, one heading', async () => {
    const summary = trSummary({ expenses: [exp(1), exp(2, { amountCents: 500, splits: [{ familyId: 'smith', cents: 500 }] })], photos: { e1: ['a', 'b'], e2: ['c'] } });
    const built = await buildSummaryPdf(summary, null, goodPhoto, { compress: false });
    expect(built.pageCount).toBe(3);
    const t = await texts(built);
    expect(t.filter((x) => x.text === 'Fişler')).toHaveLength(1);
    expect(t.map((x) => x.text)).toEqual(expect.arrayContaining(['Expense 1 — $18.75 (1/2)', 'Expense 1 — $18.75 (2/2)', 'Expense 2 — $5.00']));
    expect(t.filter((x) => x.size === 8).map((x) => x.text.slice(-9))).toEqual(['Sayfa 1 / 3', 'Sayfa 2 / 3', 'Sayfa 3 / 3'].map((x) => x.slice(-9)));
    expect(t[0].text).toBe('Smith ailesi — 12–18 Ekim 2026');
  });

  it('long lists continue on new pages with the repeated heading and no row passes the bottom margin', async () => {
    const sessions = Array.from({ length: 40 }, (_, i) =>
      trSession({ id: `s${i + 1}`, date: `2026-10-${String(12 + (i % 7)).padStart(2, '0')}`, createdAt: i + 1, lessonMinutes: 45, activityMinutes: 15 }),
    );
    const long = 'x'.repeat(120);
    const summary = trSummary({ sessions, expenses: [exp(1, { description: long, sessionId: 's1' })] });
    const built = await buildSummaryPdf(summary, 'Connor B.', noPhotos, { compress: false });
    expect(built.pageCount).toBeGreaterThan(1);
    const t = await texts(built);
    const continued = t.filter((x) => x.text === 'Dersler (devam)');
    expect(continued.length).toBeGreaterThanOrEqual(1);
    expect(new Set(continued.map((x) => x.page)).size).toBe(continued.length);
    expect(continued.every((x) => x.page > 1)).toBe(true);
    // The long unbroken description is split over several lines but none of it is lost.
    const descriptionLines = t.filter((x) => /^x+$/.test(x.text));
    expect(descriptionLines.length).toBeGreaterThan(1);
    expect(descriptionLines.map((x) => x.text).join('')).toBe(long);
    // Every body line stays inside the bottom margin (footers are 8 pt and sit in the margin).
    for (const x of t.filter((y) => y.size !== 8)) expect(x.y).toBeGreaterThanOrEqual(48);
    // 40 session rows are all there.
    expect(t.filter((x) => x.text === 'Yüzme')).toHaveLength(40);
  });

  it('wraps a 120-character description of words across lines', async () => {
    const words = 'Havuz giriş ücreti ve çocuk menüsü '.repeat(4).trim();
    const summary = trSummary({ expenses: [exp(1, { description: words })] });
    const built = await buildSummaryPdf(summary, null, noPhotos, { compress: false });
    const t = await texts(built);
    const lines = t.filter((x) => x.x > 120 && x.x < 140 && x.y < 600 && /Havuz|giriş|ücreti|menüsü|ve|çocuk/.test(x.text));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((x) => x.text).join(' ').replace(/\s+/g, ' ')).toBe(words);
  });

  it('keeps the PDF totals equal to the message totals', async () => {
    const summary = trSummary({ expenses: [exp(1)] });
    const t = (await texts(await buildSummaryPdf(summary, null, noPhotos, { compress: false }))).map((x) => x.text);
    for (const line of pdfTotalsLines(summary)) expect(t).toContain(line);
  });
});

describe('buildSummaryPdf failures and memory (T-04-15, T-04-16)', () => {
  const three = () => trSummary({ expenses: [exp(1)], photos: { e1: ['a', 'b', 'c'] } });

  it('rejects with photo-unreadable when one receipt cannot be read, and returns no PDF', async () => {
    const load: LoadPhoto = async (id) => {
      if (id === 'b') throw new Error('gone');
      return goodPhoto(id);
    };
    const result = buildSummaryPdf(three(), null, load);
    await expect(result).rejects.toBeInstanceOf(PdfBuildError);
    await expect(buildSummaryPdf(three(), null, load)).rejects.toMatchObject({ code: 'photo-unreadable' });
  });

  it('rejects with too-large before asking for the next photo once the byte cap is passed', async () => {
    const asked: string[] = [];
    const load: LoadPhoto = async (id) => {
      asked.push(id);
      return goodPhoto(id);
    };
    const size = jpegBytes().length;
    await expect(buildSummaryPdf(three(), null, load, { maxPhotoBytes: size + 1 })).rejects.toMatchObject({ code: 'too-large' });
    expect(asked).toEqual(['a', 'b']);
  });

  it('asks for photos one at a time', async () => {
    const events: string[] = [];
    const load: LoadPhoto = async (id) => {
      events.push(`start ${id}`);
      await new Promise((r) => setTimeout(r, 5));
      events.push(`end ${id}`);
      return goodPhoto(id);
    };
    await buildSummaryPdf(three(), null, load);
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('stops before reading the next receipt once cancelled (WR-02)', async () => {
    const asked: string[] = [];
    let cancelled = false;
    const load: LoadPhoto = async (id) => {
      asked.push(id);
      if (id === 'a') cancelled = true;
      return goodPhoto(id);
    };
    await expect(buildSummaryPdf(three(), null, load, { isCancelled: () => cancelled })).rejects.toMatchObject({ code: 'cancelled' });
    expect(asked).toEqual(['a']);
  });

  it('a build cancelled before it starts reads no receipt at all (WR-02)', async () => {
    const load: LoadPhoto = async () => {
      throw new Error('should not be called');
    };
    await expect(buildSummaryPdf(three(), null, load, { isCancelled: () => true })).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('a photo that is not a JPEG is unreadable, not a broken image in the PDF', async () => {
    const bad: LoadPhoto = async () => ({ bytes: new Uint8Array([1, 2, 3]), width: 10, height: 10 });
    await expect(buildSummaryPdf(three(), null, bad)).rejects.toMatchObject({ code: 'photo-unreadable' });
  });
});

describe('scripts/make-font-module.mjs', () => {
  const run = (...args: string[]) => spawnSync('node', ['scripts/make-font-module.mjs', ...args], { encoding: 'utf8' });

  it('prints usage and writes nothing without arguments', () => {
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Usage');
  });

  it('writes the standard base64 of a TrueType file and refuses anything else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'font-module-'));
    try {
      const font = join(dir, 'a.ttf');
      const bad = join(dir, 'b.ttf');
      const out = join(dir, 'out.ts');
      const badOut = join(dir, 'bad.ts');

      writeFileSync(font, new Uint8Array([0, 1, 0, 0, 255, 254, 253]));
      writeFileSync(bad, new Uint8Array([79, 84, 84, 79, 1]));
      expect(run(font, 'FOO_BASE64', out).status).toBe(0);
      expect(readFileSync(out, 'utf8')).toContain("export const FOO_BASE64 =\n  'AAEAAP/+/Q==';");
      const r = run(bad, 'FOO_BASE64', badOut);
      expect(r.status).not.toBe(0);
      expect(existsSync(badOut)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
