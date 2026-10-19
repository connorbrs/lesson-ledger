import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/**
 * Subscribe to a Dexie liveQuery. Returns undefined until the first emission, and again after `deps` change.
 * A query error is rethrown during render so an error boundary can catch it.
 */
export function useLive<T>(query: () => T | Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    // New deps mean a new query: drop the previous result and error so they are never shown for the wrong deps.
    setValue(undefined);
    setError(null);
    const subscription = liveQuery(query).subscribe({
      next: (v) => setValue(() => v),
      error: (e) => setError(() => e),
    });
    return () => subscription.unsubscribe();
  }, deps);

  if (error !== null) throw error;
  return value;
}
