// TEMPORARY device-check page (Phase 1 device spike). Removed in Plan 04.
import { useEffect, useState } from 'preact/hooks';
import { db } from './data/db';

const BLOB_SIZE = 2_097_152;
const BLOB_ID = 'spike-blob';

const pattern = (i: number) => i % 251;

async function guard<T>(fn: () => Promise<T>): Promise<string | T> {
  try {
    return await fn();
  } catch (e) {
    return `ERROR: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`;
  }
}

async function infoLines(): Promise<string[]> {
  const nav = navigator as Navigator & { standalone?: boolean };
  const lines: string[] = [
    `userAgent: ${navigator.userAgent}`,
    `navigator.standalone: ${String(nav.standalone)}`,
    `display-mode standalone: ${String(window.matchMedia('(display-mode: standalone)').matches)}`,
  ];
  lines.push(
    `persist(): ${String(await guard(() => navigator.storage.persist()))}`,
    `persisted(): ${String(await guard(() => navigator.storage.persisted()))}`,
  );
  const est = await guard(() => navigator.storage.estimate());
  lines.push(
    typeof est === 'string'
      ? `estimate(): ${est}`
      : `estimate() usage: ${est.usage ?? 'n/a'} quota: ${est.quota ?? 'n/a'}`,
  );
  lines.push(`families count: ${String(await guard(() => db.families.count()))}`);
  return lines;
}

async function writeBlob(): Promise<string> {
  const bytes = new Uint8Array(BLOB_SIZE);
  for (let i = 0; i < BLOB_SIZE; i++) bytes[i] = pattern(i);
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  await db.table('attachments').put({ id: BLOB_ID, expenseId: 'spike', blob });
  return `BLOB WRITTEN size=${blob.size}`;
}

async function readBlob(): Promise<string> {
  const row = await db.table('attachments').get(BLOB_ID);
  if (!row || !(row.blob instanceof Blob)) return 'BLOB READ MISMATCH: no blob row found';
  const blob: Blob = row.blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const diffs: string[] = [];
  if (blob.size !== BLOB_SIZE) diffs.push(`blob.size=${blob.size}`);
  if (bytes.length !== BLOB_SIZE) diffs.push(`bytes.length=${bytes.length}`);
  for (const i of [0, 1, 251, BLOB_SIZE - 1]) {
    if (bytes[i] !== pattern(i)) diffs.push(`byte[${i}]=${bytes[i]} expected ${pattern(i)}`);
  }
  return diffs.length === 0
    ? 'BLOB READ OK size=2097152 pattern=ok'
    : `BLOB READ MISMATCH: ${diffs.join('; ')}`;
}

async function deleteBlob(): Promise<string> {
  await db.table('attachments').delete(BLOB_ID);
  return 'BLOB DELETED';
}

export function Spike() {
  const [lines, setLines] = useState<string[]>(['loading...']);
  const [result, setResult] = useState('');

  const refresh = async () => setLines(await infoLines());
  useEffect(() => {
    void refresh();
  }, []);

  const run = (fn: () => Promise<string>) => async () => {
    setResult('working...');
    setResult(String(await guard(fn)));
  };

  return (
    <main>
      <h1>Device check</h1>
      <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {lines.join('\n')}
      </pre>
      <p>
        <button type="button" onClick={() => void refresh()}>
          Refresh storage info
        </button>
      </p>
      <p>
        <button type="button" onClick={run(writeBlob)}>
          Write 2 MB blob
        </button>{' '}
        <button type="button" onClick={run(readBlob)}>
          Read blob back
        </button>{' '}
        <button type="button" onClick={run(deleteBlob)}>
          Delete blob
        </button>
      </p>
      <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {result}
      </pre>
      <p>
        <a href="./">Back to app</a>
      </p>
    </main>
  );
}
