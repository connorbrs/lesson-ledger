import { createPortal } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { Alert, NavBar, PushLayer, useAnimatedClose } from './components';
import { useReceiptUrl, type PhotoStage } from './receiptPhotos';

/**
 * One receipt photo full size on a black surround. The only action is Remove Photo, behind a confirm alert.
 * Removal is staged by the caller; the session's save deletes the stored row.
 */
export function ReceiptViewer(props: {
  photoIds: readonly string[];
  index: number;
  stage: PhotoStage;
  inSheet?: boolean;
  onRemove: (id: string) => void;
  onClosed: () => void;
}) {
  // Fixed at open: removing the photo changes photoIds while the close animation still plays.
  const [shown] = useState(() => ({ id: props.photoIds[props.index], n: props.index + 1, total: props.photoIds.length }));
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  const url = useReceiptUrl(shown.id, props.stage);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirming = useRef(false); // a double-tapped Remove runs once

  function remove() {
    if (confirming.current) return;
    confirming.current = true;
    setConfirmOpen(false);
    props.onRemove(shown.id);
    close();
  }

  return (
    <>
      <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
        <div class="screen">
          <NavBar
            inSheet={props.inSheet}
            title={`Receipt ${shown.n} of ${shown.total}`}
            back={{ label: 'Expense', onClick: close }}
          />
          <div class={`receipt-viewer${props.inSheet ? ' in-sheet' : ''}`}>
            <div class="receipt-viewer-image">
              {typeof url === 'string' && !imageFailed && <img src={url} alt={`Receipt ${shown.n} of ${shown.total}`} onError={() => setImageFailed(true)} />}
              {(url === null || imageFailed) && (
                <p class="label receipt-viewer-error">This photo couldn't be shown. Remove it and add it again.</p>
              )}
            </div>
            <div class="receipt-viewer-footer">
              <button type="button" class="text-button receipt-remove" onClick={() => setConfirmOpen(true)}>
                Remove Photo
              </button>
            </div>
          </div>
        </div>
      </PushLayer>
      {confirmOpen &&
        createPortal(
          <Alert
            title="Remove this receipt photo?"
            message="It's deleted when you save the session."
            buttons={[
              { label: 'Cancel', tone: 'accent', onClick: () => setConfirmOpen(false) },
              { label: 'Remove', tone: 'destructive', strong: true, onClick: remove },
            ]}
          />,
          document.querySelector('.app') ?? document.body,
        )}
    </>
  );
}
