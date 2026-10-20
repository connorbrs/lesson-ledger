/** The browser clipboard, injected so tests can pass fakes. */
export interface ClipboardEnv {
  writeText?: (text: string) => Promise<void>;
}

function defaultEnv(): ClipboardEnv {
  const clipboard = globalThis.navigator?.clipboard;
  return { writeText: clipboard?.writeText?.bind(clipboard) };
}

/**
 * Copies plain text. The write starts in the same call, with nothing before it that could give up the tap's user
 * activation (iOS Safari refuses a clipboard write that runs later). Resolves true on success and false on any
 * refusal or a missing API; it never throws. There is no fallback to another API.
 */
export function copyText(text: string, env: ClipboardEnv = defaultEnv()): Promise<boolean> {
  try {
    if (!env.writeText) return Promise.resolve(false);
    return env.writeText(text).then(
      () => true,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}
