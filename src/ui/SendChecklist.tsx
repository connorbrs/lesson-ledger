import { sendChecklistLabel, type SendStage, type StageTone } from '../domain/summaryState';

/** A drawn status glyph: check in a ring (done), triangle (attention) or a dot in a ring (idle). One 2px stroke throughout. */
export function StatusGlyph(props: { tone: StageTone; class?: string }) {
  return (
    <svg
      class={`glyph ${props.tone}${props.class ? ` ${props.class}` : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.tone === 'done' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M7.8 12.4 10.8 15.4 16.4 9.2" />
        </>
      )}
      {props.tone === 'attention' && <path d="M12 3.5 21.5 20h-19Z M12 10v4.5 M12 17.2h.01" />}
      {props.tone === 'idle' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11.9h.01" />
        </>
      )}
    </svg>
  );
}

/** The send checklist: three joined stage cells, Checked then Message then Sent. Everything shown is derived from stored state. */
export function SendChecklist(props: { stages: readonly SendStage[] }) {
  return (
    <section class="section" aria-label="Send checklist">
      <ol class="checklist">
        {props.stages.map((s) => (
          <li key={s.id} class={`stage ${s.tone}`}>
            <span class="stage-head">
              <StatusGlyph tone={s.tone} />
            </span>
            <span class="stage-title">{s.title}</span>
            <span class="stage-detail">{s.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The same three stages as three small glyphs, for a Summaries row. The words are in the label for screen readers. */
export function MiniChecklist(props: { stages: readonly SendStage[] }) {
  return (
    <span class="mini-checklist" role="img" aria-label={sendChecklistLabel(props.stages)}>
      {props.stages.map((s) => (
        <StatusGlyph key={s.id} tone={s.tone} />
      ))}
    </span>
  );
}
