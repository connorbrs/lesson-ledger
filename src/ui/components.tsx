import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/* ---------- Icons: inline SVG, 24x24, 2px stroke, currentColor ---------- */

const svgProps = {
  class: 'icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': true,
} as const;

export function PeopleIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M18 14.4c2 .7 3.5 2.6 3.5 5.6" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg {...svgProps} class="icon icon-chevron" viewBox="0 0 12 12" stroke-width={2}>
      <path d="M4 1.5 8.5 6 4 10.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

/* ---------- Chrome ---------- */

export function NavBar(props: {
  title?: string;
  back?: { label: string; onClick: () => void };
  right?: ComponentChildren;
  inSheet?: boolean;
  left?: ComponentChildren;
  /** Tab roots with a large title and no buttons: no empty 44px row, safe area only. */
  bare?: boolean;
}) {
  return (
    <header class={`nav-bar${props.inSheet ? ' in-sheet' : ''}${props.bare ? ' bare' : ''}`}>
      <div class="nav-left">
        {props.left}
        {props.back && (
          <button type="button" class="text-button" onClick={props.back.onClick}>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
            {props.back.label}
          </button>
        )}
      </div>
      {props.title ? <h1 class="nav-title">{props.title}</h1> : <div />}
      <div class="nav-right">{props.right}</div>
    </header>
  );
}

export type TabId = 'people' | 'settings';

export function TabBar(props: { tab: TabId; onSelect: (tab: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: ComponentChildren }[] = [
    { id: 'people', label: 'People', icon: <PeopleIcon /> },
    { id: 'settings', label: 'Settings', icon: <GearIcon /> },
  ];
  return (
    <nav class="tab-bar" aria-label="Tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          class="tab"
          aria-current={props.tab === t.id ? 'page' : undefined}
          onClick={() => props.onSelect(t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** A screen with a nav bar and a scroll container; the nav bar shows a hairline once content scrolls under it. */
export function Screen(props: { nav: ComponentChildren; inSheet?: boolean; children: ComponentChildren }) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div class={`screen${scrolled ? ' scrolled' : ''}`}>
      {props.nav}
      <div class={`scroll${props.inSheet ? ' in-sheet' : ''}`} onScroll={(e) => setScrolled((e.currentTarget as HTMLElement).scrollTop > 0)}>
        {props.children}
      </div>
    </div>
  );
}

/* ---------- Grouped list ---------- */

export function Group(props: {
  header?: string;
  headerAction?: { label: string; onClick: () => void };
  footer?: ComponentChildren;
  footerError?: boolean;
  children: ComponentChildren;
}) {
  return (
    <section class="section">
      {props.header !== undefined && (
        <div class="group-header">
          <h2 class="group-title clamp2">{props.header}</h2>
          {props.headerAction && (
            <button type="button" class="text-button" onClick={props.headerAction.onClick}>
              {props.headerAction.label}
            </button>
          )}
        </div>
      )}
      <div class="group">{props.children}</div>
      {props.footer && <div class={`group-footer${props.footerError ? ' error' : ''}`}>{props.footer}</div>}
    </section>
  );
}

export function Row(props: {
  onClick?: () => void;
  chevron?: boolean;
  value?: string;
  tone?: 'accent' | 'destructive' | 'secondary';
  children: ComponentChildren;
}) {
  const cls = `row${props.tone ? ` tone-${props.tone}` : ''}`;
  const content = (
    <>
      <span class="row-label clamp2">{props.children}</span>
      {props.value !== undefined && <span class="row-value clamp2">{props.value}</span>}
      {props.chevron && <ChevronIcon />}
    </>
  );
  return props.onClick ? (
    <button type="button" class={cls} onClick={props.onClick}>
      {content}
    </button>
  ) : (
    <div class={cls}>{content}</div>
  );
}

export function InputRow(props: {
  label: string;
  value: string;
  placeholder: string;
  onInput: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <label class="row input-row">
      <span class="row-fixed-label">{props.label}</span>
      <input
        ref={ref}
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.label}
        aria-invalid={props.invalid ? true : undefined}
        autocapitalize="words"
        autocorrect="off"
        enterkeyhint="done"
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onBlur={props.onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function SegmentedControl<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          class="segment"
          role="radio"
          aria-checked={props.value === o.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Animated presentation (sheet and pushed screens) ---------- */

/**
 * Plays the exit animation, then calls onClosed once. A timer backs up animationend
 * so a missing animation event can never leave the layer stuck on screen.
 */
export function useAnimatedClose(onClosed: () => void, ms: number) {
  const [closing, setClosing] = useState(false);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onClosed();
  };
  return {
    closing,
    close: () => {
      if (closing) return;
      setClosing(true);
      setTimeout(finish, ms);
    },
    onAnimationEnd: (e: Event) => {
      if (closing && e.target === e.currentTarget) finish();
    },
  };
}

export function PushLayer(props: { closing: boolean; onAnimationEnd: (e: Event) => void; children: ComponentChildren }) {
  return (
    <div class={`push-layer${props.closing ? ' closing' : ''}`} onAnimationEnd={props.onAnimationEnd}>
      {props.children}
    </div>
  );
}

export function Sheet(props: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  closing: boolean;
  onAnimationEnd: (e: Event) => void;
  /** Pushed content (for example the family picker) that covers the form inside the sheet. */
  overlay?: ComponentChildren;
  children: ComponentChildren;
}) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div class={`sheet-layer${props.closing ? ' closing' : ''}`}>
      <div class="sheet-scrim" />
      <div class={`sheet${scrolled ? ' scrolled' : ''}`} role="dialog" aria-modal="true" aria-label={props.title} onAnimationEnd={props.onAnimationEnd}>
        <header class="nav-bar in-sheet">
          <div class="nav-left">
            <button type="button" class="text-button" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
          <h1 class="nav-title">{props.title}</h1>
          <div class="nav-right">
            <button type="button" class="text-button strong" disabled={props.saveDisabled} onClick={props.onSave}>
              Save
            </button>
          </div>
        </header>
        <div class="scroll in-sheet" onScroll={(e) => setScrolled((e.currentTarget as HTMLElement).scrollTop > 0)}>
          <div class="sheet-body-top" />
          {props.children}
        </div>
        {props.overlay}
      </div>
    </div>
  );
}

export interface AlertButton {
  label: string;
  tone: 'accent' | 'destructive';
  strong?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function Alert(props: { title: string; message?: string; buttons: AlertButton[] }) {
  return (
    <div class="alert-layer">
      <div class="alert" role="alertdialog" aria-modal="true" aria-label={props.title}>
        <div class="alert-text">
          <h2 class="alert-title">{props.title}</h2>
          {props.message && <p class="alert-message" role="status">{props.message}</p>}
        </div>
        {props.buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            class={`alert-button${b.tone === 'destructive' ? ' destructive' : ''}${b.strong ? ' strong' : ''}`}
            disabled={b.disabled}
            onClick={b.onClick}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
