import { useMemo, useRef, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { singleFlight } from './singleFlight';

/**
 * Update lifecycle for the service worker (APP-05). The update only swaps the app shell:
 * this file must not import the data layer or touch IndexedDB, so an interrupted update
 * cannot affect records. An update is applied only when apply() is called.
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // A home-screen app rarely navigates, so check for a new version whenever it comes to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
      });
    },
  });
  const [applying, setApplying] = useState(false);
  const [failed, setFailed] = useState(false);

  // Always call the latest updateServiceWorker without recreating the single-flight wrapper.
  const latest = useRef(updateServiceWorker);
  latest.current = updateServiceWorker;

  const apply = useMemo(
    () =>
      singleFlight(async () => {
        setApplying(true);
        setFailed(false);
        try {
          await latest.current(true);
        } catch {
          setFailed(true);
          setApplying(false);
        }
      }),
    [],
  );

  return {
    needRefresh,
    applying,
    failed,
    apply: () => void apply(),
    notNow: () => setNeedRefresh(false),
  };
}
