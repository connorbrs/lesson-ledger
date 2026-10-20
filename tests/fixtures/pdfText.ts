/** Reads the text back out of an UNCOMPRESSED jsPDF output that uses the two embedded Noto Sans faces (Identity-H). */

export interface DrawnText {
  /** 1-based page number. */
  page: number;
  size: number;
  /** PDF user space: y counts up from the bottom edge. */
  x: number;
  y: number;
  text: string;
}

export async function pdfRaw(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

/** gid to character from every ToUnicode map; the two faces share one glyph order, and a conflict fails loudly. */
function glyphMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of section[1].matchAll(/<([0-9a-fA-F]{4})><([0-9a-fA-F]{4})>/g)) {
      const gid = m[1].toLowerCase();
      const ch = String.fromCharCode(parseInt(m[2], 16));
      const prev = map.get(gid);
      if (prev !== undefined && prev !== ch) throw new Error(`glyph ${gid} maps to both ${prev} and ${ch}`);
      map.set(gid, ch);
    }
  }
  return map;
}

export function drawnTexts(raw: string): DrawnText[] {
  const map = glyphMap(raw);
  const out: DrawnText[] = [];
  // Page content streams, in page order, are the streams that hold a BT block.
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => m[1]).filter((s) => s.includes('BT'));
  streams.forEach((stream, i) => {
    for (const block of stream.matchAll(/BT([\s\S]*?)ET/g)) {
      const size = /\/F\d+ ([\d.]+) Tf/.exec(block[1]);
      const pos = /([\d.-]+) ([\d.-]+) Td/.exec(block[1]);
      const hex = /<([0-9a-fA-F]+)> Tj/.exec(block[1]);
      if (!size || !pos || !hex) continue;
      let text = '';
      for (let k = 0; k < hex[1].length; k += 4) text += map.get(hex[1].slice(k, k + 4).toLowerCase()) ?? '?';
      out.push({ page: i + 1, size: Number(size[1]), x: Number(pos[1]), y: Number(pos[2]), text });
    }
  });
  return out;
}
