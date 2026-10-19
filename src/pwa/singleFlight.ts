/**
 * Wraps an async function so that calls made while a previous call is still
 * pending share that call's promise. The shared promise is cleared once it
 * settles (fulfilled or rejected); results are never cached after that.
 */
export function singleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let inFlight: Promise<R> | null = null;
  return (...args: A) => {
    if (inFlight) return inFlight;
    const p = fn(...args).finally(() => {
      inFlight = null;
    });
    inFlight = p;
    return p;
  };
}
