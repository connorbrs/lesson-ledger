// Rasterizes assets/icon.svg geometry (512-unit canvas) to opaque RGB PNGs.
// Dependency-free: zlib + manual CRC32. Keep the geometry in sync with assets/icon.svg.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const TEAL = [0x00, 0x70, 0x7a];
const WHITE = [0xff, 0xff, 0xff];
const SS = 4; // 4x4 supersampling

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// true when the point (in 512-unit canvas coordinates) is white
function isWhite(x, y) {
  const d = Math.hypot(x - 256, y - 256);
  if (Math.abs(d - 150) <= 14) return true; // ring: radius 150, stroke 28
  if (d <= 18) return true; // center dot
  if (distToSegment(x, y, 256, 256, 256, 142) <= 13) return true; // minute hand
  if (distToSegment(x, y, 256, 256, 326, 296) <= 13) return true; // hour hand
  return false;
}

function pixel(px, py, size) {
  const scale = 512 / size;
  let white = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const x = (px + (sx + 0.5) / SS) * scale;
      const y = (py + (sy + 0.5) / SS) * scale;
      if (isWhite(x, y)) white++;
    }
  }
  const a = white / (SS * SS);
  return TEAL.map((c, i) => Math.round(c + (WHITE[i] - c) * a));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  let topLeft;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const rgb = pixel(x, y, size);
      if (x === 0 && y === 0) topLeft = rgb;
      raw[o++] = rgb[0];
      raw[o++] = rgb[1];
      raw[o++] = rgb[2];
    }
  }
  if (topLeft.join() !== TEAL.join()) throw new Error(`top-left pixel is ${topLeft}, expected #00707A`);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB, no alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/apple-touch-icon.png', png(180));
writeFileSync('public/icons/icon-512.png', png(512));
console.log('wrote public/apple-touch-icon.png (180x180) and public/icons/icon-512.png (512x512)');
