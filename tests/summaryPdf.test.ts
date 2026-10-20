import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSummaryPdf } from '../src/pdf/summaryPdf';
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
