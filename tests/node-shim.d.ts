// Minimal typings for the few Node built-ins the tests use, so no @types/node package is needed.
declare const Buffer: {
  from(data: Uint8Array | ArrayBuffer): { toString(encoding: 'base64'): string };
};
declare module 'node:child_process' {
  export function spawnSync(
    command: string,
    args: string[],
    options?: { encoding: 'utf8' },
  ): { status: number | null; stdout: string; stderr: string };
}
declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: Uint8Array): void;
  export function statSync(path: string): { size: number };
  export function existsSync(path: string): boolean;
  export function rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
