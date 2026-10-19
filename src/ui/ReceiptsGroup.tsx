import { useRef } from 'preact/hooks';
import { Group } from './components';
import { useReceiptUrl, type PhotoStage } from './receiptPhotos';

function Thumb(props: { id: string; n: number; total: number; stage: PhotoStage; onOpen: () => void }) {
  const url = useReceiptUrl(props.id, props.stage);
  return (
    <button type="button" class="receipt-tile receipt-thumb" aria-label={`Receipt ${props.n} of ${props.total}, open`} onClick={props.onOpen}>
      {typeof url === 'string' && <img src={url} alt="" />}
    </button>
  );
}

/** The Expense editor's Receipts group: thumbnails in the order added, processing tiles, then the Add Photo tile. */
export function ReceiptsGroup(props: {
  photoIds: readonly string[];
  stage: PhotoStage;
  processing: number;
  caption: string | null;
  onAddFiles: (files: File[]) => void;
  onOpen: (index: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const total = props.photoIds.length;
  return (
    <Group header="Receipts" footer="Photos stay on this phone and are included in backups.">
      <div class="receipt-grid">
        {props.photoIds.map((id, i) => (
          <Thumb key={id} id={id} n={i + 1} total={total} stage={props.stage} onOpen={() => props.onOpen(i)} />
        ))}
        {Array.from({ length: props.processing }, (_, i) => (
          <div key={`processing-${i}`} class="receipt-tile receipt-processing">
            <span class="label">Processing…</span>
          </div>
        ))}
        <button type="button" class="receipt-tile receipt-add" disabled={props.processing > 0} onClick={() => input.current?.click()}>
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 8v8 M8 12h8" />
          </svg>
          <span class="label">Add Photo</span>
        </button>
        <input
          ref={input}
          class="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const el = e.currentTarget;
            const files = Array.from(el.files ?? []);
            el.value = '';
            if (files.length > 0) props.onAddFiles(files);
          }}
        />
      </div>
      {props.caption && <p class="label receipt-caption">{props.caption}</p>}
      <span class="visually-hidden" role="status">
        {props.processing > 0 ? 'Processing photos' : ''}
      </span>
    </Group>
  );
}
