import { useState } from 'preact/hooks';

export function SafariBanner() {
  const [open, setOpen] = useState(false);
  return (
    <aside class="safari-banner">
      <h2 class="heading">You're in Safari</h2>
      <p>
        Your records are saved by the Lesson Ledger app on your Home Screen. This Safari tab keeps separate data, so
        anything you add here won't appear there.
      </p>
      {open ? (
        <ol class="install-steps">
          <li>1. Tap the Share button.</li>
          <li>2. Tap Add to Home Screen.</li>
          <li>3. Open Lesson Ledger from your Home Screen and use it from there.</li>
        </ol>
      ) : (
        <button type="button" class="text-button banner-action" onClick={() => setOpen(true)}>
          Show Install Steps
        </button>
      )}
    </aside>
  );
}

export function UpdateBanner(props: { applying: boolean; failed: boolean; onUpdate: () => void; onNotNow: () => void }) {
  return (
    <section class="update-card" aria-label="Update available">
      <h2 class="heading">Update available</h2>
      <p>A new version of Lesson Ledger is ready. Your records stay on this phone. Save any open form first.</p>
      {props.failed && (
        <p class="banner-error" role="status">
          Couldn't update. Close Lesson Ledger and reopen it from your Home Screen.
        </p>
      )}
      <div class="update-actions">
        <button type="button" class="primary-button" disabled={props.applying} onClick={props.onUpdate}>
          {props.applying ? 'Updating App…' : 'Update App'}
        </button>
        {!props.applying && (
          <button type="button" class="text-button" onClick={props.onNotNow}>
            Not Now
          </button>
        )}
      </div>
    </section>
  );
}

export function RecordsError() {
  const [retrying, setRetrying] = useState(false);
  return (
    <div class="records-error">
      <h2 class="heading">Can't open your records</h2>
      <p>Lesson Ledger couldn't open its storage on this phone. Nothing has been changed.</p>
      <button
        type="button"
        class="primary-button full"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          location.reload();
        }}
      >
        Retry Opening Records
      </button>
    </div>
  );
}
