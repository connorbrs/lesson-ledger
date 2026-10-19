import { describe, expect, it } from 'vitest';
import {
  fitLongEdge,
  hasJpegMagic,
  MAX_LONG_EDGE,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_PIXELS,
  MAX_STORED_PHOTO_BYTES,
  photoFailureCaption,
} from '../src/domain/photos';
import { PhotoError, prepareReceipt, prepareReceipts, type DecodedImage, type PhotoEnv } from '../src/pwa/photos';

describe('fitLongEdge', () => {
  it('shrinks the long edge to 1600 and keeps the aspect', () => {
    expect(fitLongEdge(4032, 3024)).toEqual({ w: 1600, h: 1200 });
    expect(fitLongEdge(3024, 4032)).toEqual({ w: 1200, h: 1600 });
  });

  it('never upscales', () => {
    expect(fitLongEdge(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitLongEdge(1600, 1600)).toEqual({ w: 1600, h: 1600 });
  });

  it('never rounds a side to 0', () => {
    expect(fitLongEdge(1, 10000)).toEqual({ w: 1, h: 1600 });
  });

  it.each([
    [0, 5],
    [5, 0],
    [-1, 5],
    [1.5, 5],
    [NaN, 5],
  ])('returns null for %s x %s', (w, h) => {
    expect(fitLongEdge(w, h)).toBeNull();
  });

  it('uses MAX_LONG_EDGE by default', () => {
    expect(MAX_LONG_EDGE).toBe(1600);
  });
});

describe('hasJpegMagic', () => {
  it('accepts FF D8 FF and rejects anything else', () => {
    expect(hasJpegMagic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasJpegMagic(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(false);
    expect(hasJpegMagic(new Uint8Array([0xff, 0xd8]))).toBe(false);
    expect(hasJpegMagic(new Uint8Array([]))).toBe(false);
  });
});

describe('photoFailureCaption', () => {
  it('is null with no failures', () => {
    expect(photoFailureCaption({ tooLarge: 0, unreadable: 0 })).toBeNull();
  });

  it('gives the exact sentences', () => {
    const large = 'This photo is too large to add. Choose a smaller photo.';
    const one = "This photo couldn't be read and wasn't added. Choose it again or take a new photo.";
    expect(photoFailureCaption({ tooLarge: 1, unreadable: 0 })).toBe(large);
    expect(photoFailureCaption({ tooLarge: 0, unreadable: 1 })).toBe(one);
    expect(photoFailureCaption({ tooLarge: 0, unreadable: 3 })).toBe("3 photos couldn't be read and weren't added. Choose them again or take new photos.");
    expect(photoFailureCaption({ tooLarge: 1, unreadable: 1 })).toBe(`${large} ${one}`);
  });
});

const jpegBytes = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const jpeg = (bytes = jpegBytes, type = 'image/jpeg') => new Blob([new Uint8Array(bytes)], { type });
const source = (size = 1000) => ({ size, type: 'image/jpeg' }) as unknown as Blob;

interface FakeOpts {
  width?: number;
  height?: number;
  decodeFails?: boolean;
  encoded?: Blob | null | 'throw';
}

function fakeEnv(opts: FakeOpts = {}) {
  const log = { decodes: 0, inFlight: 0, maxInFlight: 0, releases: 0, encodes: [] as [number, number][] };
  const env: PhotoEnv = {
    async decode() {
      log.decodes += 1;
      log.inFlight += 1;
      log.maxInFlight = Math.max(log.maxInFlight, log.inFlight);
      await Promise.resolve();
      if (opts.decodeFails) {
        log.inFlight -= 1;
        throw new Error('cannot decode');
      }
      const image: DecodedImage = {
        width: opts.width ?? 4032,
        height: opts.height ?? 3024,
        source: {},
        release() {
          log.releases += 1;
          log.inFlight -= 1;
        },
      };
      return image;
    },
    async encode(_image, w, h) {
      log.encodes.push([w, h]);
      await Promise.resolve();
      if (opts.encoded === 'throw') throw new Error('encode blew up');
      return opts.encoded === undefined ? jpeg() : opts.encoded;
    },
  };
  return { env, log };
}

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof PhotoError ? e.code : `other:${String(e)}`;
  }
  return 'resolved';
};

describe('prepareReceipt', () => {
  it('resolves the fitted JPEG and releases the decode once', async () => {
    const { env, log } = fakeEnv();
    const out = await prepareReceipt(source(), env);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1200);
    expect(out.blob.type).toBe('image/jpeg');
    expect(log.encodes).toEqual([[1600, 1200]]);
    expect(log.releases).toBe(1);
  });

  it('refuses an oversized source before decoding', async () => {
    const { env, log } = fakeEnv();
    expect(await codeOf(prepareReceipt(source(MAX_SOURCE_BYTES + 1), env))).toBe('too-large');
    expect(log.decodes).toBe(0);
  });

  it('refuses a decoded image over the pixel cap and releases it', async () => {
    const side = Math.ceil(Math.sqrt(MAX_SOURCE_PIXELS)) + 1;
    const { env, log } = fakeEnv({ width: side, height: side });
    expect(await codeOf(prepareReceipt(source(), env))).toBe('too-large');
    expect(log.releases).toBe(1);
    expect(log.encodes).toEqual([]);
  });

  it('maps a decode failure to unreadable', async () => {
    const { env, log } = fakeEnv({ decodeFails: true });
    expect(await codeOf(prepareReceipt(source(), env))).toBe('unreadable');
    expect(log.decodes).toBe(1);
    expect(log.releases).toBe(0); // nothing was decoded to release
  });

  it.each([
    ['null', null],
    ['wrong type', jpeg(jpegBytes, 'image/png')],
    ['wrong magic', jpeg([0x89, 0x50, 0x4e, 0x47])],
    ['empty', jpeg([])],
  ])('maps an encode result that is %s to unreadable and releases', async (_name, encoded) => {
    const { env, log } = fakeEnv({ encoded });
    expect(await codeOf(prepareReceipt(source(), env))).toBe('unreadable');
    expect(log.releases).toBe(1);
  });

  it('maps an encode throw to unreadable and releases', async () => {
    const { env, log } = fakeEnv({ encoded: 'throw' });
    expect(await codeOf(prepareReceipt(source(), env))).toBe('unreadable');
    expect(log.releases).toBe(1);
  });

  it('maps an over-cap stored JPEG to too-large and releases', async () => {
    const big = jpeg(jpegBytes);
    Object.defineProperty(big, 'size', { value: MAX_STORED_PHOTO_BYTES + 1 });
    const { env, log } = fakeEnv({ encoded: big });
    expect(await codeOf(prepareReceipt(source(), env))).toBe('too-large');
    expect(log.releases).toBe(1);
  });
});

describe('prepareReceipts', () => {
  const collect = () => {
    const events: string[] = [];
    return {
      events,
      handlers: {
        onPhoto: (p: { width: number }) => void events.push(`photo:${p.width}`),
        onFailure: (c: string) => void events.push(`fail:${c}`),
      },
    };
  };

  it('processes strictly one file at a time, in order', async () => {
    const { env, log } = fakeEnv();
    const c = collect();
    await prepareReceipts([source(), source(), source()], c.handlers, env);
    expect(log.maxInFlight).toBe(1);
    expect(log.decodes).toBe(3);
    expect(log.releases).toBe(3);
    expect(c.events).toEqual(['photo:1600', 'photo:1600', 'photo:1600']);
  });

  it('keeps going after a failure and reports it in order', async () => {
    const { env } = fakeEnv();
    const c = collect();
    await prepareReceipts([source(), source(MAX_SOURCE_BYTES + 1), source()], c.handlers, env);
    expect(c.events).toEqual(['photo:1600', 'fail:too-large', 'photo:1600']);
  });

  it('calls nothing for files after isCancelled returns true', async () => {
    const { env, log } = fakeEnv();
    const c = collect();
    let done = 0;
    await prepareReceipts(
      [source(), source(), source()],
      {
        onPhoto: (p) => {
          done += 1;
          c.handlers.onPhoto(p);
        },
        onFailure: c.handlers.onFailure,
        isCancelled: () => done >= 1,
      },
      env,
    );
    expect(c.events).toEqual(['photo:1600']);
    expect(log.decodes).toBe(1);
  });

  it('does not report a photo that finishes after cancellation', async () => {
    const { env } = fakeEnv();
    const c = collect();
    let cancelled = false;
    const run = prepareReceipts([source()], { ...c.handlers, isCancelled: () => cancelled }, env);
    cancelled = true;
    await run;
    expect(c.events).toEqual([]);
  });

  it('maps an unexpected throw to unreadable', async () => {
    const env: PhotoEnv = {
      decode: () => {
        throw new TypeError('boom');
      },
      encode: async () => null,
    };
    const c = collect();
    await prepareReceipts([source()], c.handlers, env);
    expect(c.events).toEqual(['fail:unreadable']);
  });
});
