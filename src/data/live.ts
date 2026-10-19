import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/**
 * Subscribe to a Dexie liveQuery. Returns undefined until the first emission.
 * A query error is rethrown during render so an error boundary can catch it.
 */
export function useLive<T>(query: () => T | Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (v) => setValue(() => v),
      error: (e) => setError(() => e),
    });
    return () => subscription.unsubscribe();
  }, deps);

  if (error !== null) throw error;
  return value;
}
