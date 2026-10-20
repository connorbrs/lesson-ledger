---
name: Lesson Ledger
description: A graphite working ledger for one instructor's hours, where colour is state and figures are monospaced.
colors:
  bg-grouped: "#f6f8fa"
  surface: "#ffffff"
  elevated: "#eef1f4"
  surface-translucent: "rgba(246, 248, 250, 0.92)"
  accent: "#0969da"
  on-accent: "#ffffff"
  success: "#1a7f37"
  warning: "#8a5700"
  destructive: "#cf222e"
  swim: "#07707e"
  math: "#8250df"
  text: "#1f2328"
  text-secondary: "#59636e"
  separator: "#d0d7de"
  pressed: "#eaeef2"
  scrim: "rgba(13, 17, 23, 0.45)"
  selection: "rgba(9, 105, 218, 0.22)"
  viewer-surround: "#000000"
typography:
  display:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  secondary:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  group-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
  metric:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  none: "0"
  hint: "2px"
  segment: "6px"
  group: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.heading}"
    rounded: "{rounded.segment}"
    height: "44px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.accent}"
    typography: "{typography.heading}"
    rounded: "{rounded.segment}"
    height: "44px"
    padding: "0 16px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.destructive}"
    typography: "{typography.heading}"
    rounded: "{rounded.segment}"
    height: "44px"
  text-button:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.body}"
    height: "44px"
    padding: "0 16px"
  group:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.group}"
  row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    height: "44px"
    padding: "12px 16px"
  segmented-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.segment}"
    height: "32px"
  metric-cell:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.metric}"
    height: "72px"
    padding: "10px 12px 12px"
  status-stage:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    padding: "12px 12px 14px"
---

<!-- Recorded after the build at commit c263610 (branch redesign/graphite). Values are read from src/ui/styles.css and src/ui/*.tsx. Dark-mode values and the sidecar live in .impeccable/design.json. -->

# Design System: Lesson Ledger

## Overview

**Creative North Star: "The Graphite Console"**

Lesson Ledger is a working ledger for one instructor's hours. It sits on a graphite ground, and every panel is one step lighter than the ground and divided from its neighbours by a 1px seam. There are no shadows at rest. The interface is quiet and dense on purpose: it is read at night, sitting down, while catching up on the day's sessions.

Colour is only ever state. Blue marks what can be acted on, green marks sent or done, amber marks something to check or changed since sent, and red marks destructive actions, which are always outlined and isolated by space. Two subject tags (Swim cyan, Math violet) are the only other colour. Everything the instructor reads as a measurement (times, minutes, hours, money) is set in a monospaced, tabular face, so a column of figures lines up at a glance.

The signature is the send checklist: three stage cells, Check, Message and Sent, drawn from stored state on each family's summary and echoed as three small dots on each Summaries row. Motion is limited to panels opening along one axis and sheets or pushed screens sliding in.

**Key Characteristics:**
- Graphite ground, panels one elevation step up, separated by 1px seams.
- Colour appears only for state, plus the two subject tags.
- Measured values in the monospaced face; labels in tracked small caps in muted grey.
- Flat at rest; depth by tonal step and seam.
- Standard iOS controls (tab bar, nav bar, sheets, alerts, segmented controls) with a graphite skin.
- Light theme is the same system on cool paper; dark (graphite) is the evening default.

## Colors

A two-mode neutral system: cool graphite in dark, cool paper in light, with state colours that carry all meaning.

### Primary
- **Actionable Blue** (#0969da; dark #79c0ff): The accent. Primary button fill, active tab, active segment, links-as-buttons, text buttons, focus outline, caret. Blue means "you can press this."

### Secondary
- **Sent Green** (#1a7f37; dark #56d364): Done and sent states: a Summaries row marked sent, the Check and Sent stages once complete, a done row value.
- **Changed Amber** (#8a5700; dark #e3b341): Attention states: a warning stage, a summary changed since sent, the backup reminder row, a glyph marking something to check.
- **Destructive Red** (#cf222e; dark #ff7b72): Destructive actions and validation errors only. Always an outline button with 24px of clear space, never a filled control.

### Tertiary
- **Swim Cyan** (#07707e; dark #56d4dd): Swim subject tag only.
- **Math Violet** (#8250df; dark #d2a8ff): Math subject tag only.

### Neutral
- **Graphite Ground** (#f6f8fa; dark #0d1117): The app background (`bg-grouped`), tab bar, and pushed-screen ground.
- **Panel Surface** (#ffffff; dark #151a22): Grouped panels, nav bar, checklist, message box, receipt footer.
- **Raised Panel** (#eef1f4; dark #1c222b): One step up. Alerts, secondary buttons, the selected segment, skeleton bars, the highlighted metric cell.
- **Ink** (#1f2328; dark #e6edf3): Primary text.
- **Muted Ink** (#59636e; dark #9198a1): Secondary text, labels, footers, group headers, placeholders, the disabled state.
- **Seam** (#d0d7de; dark #262c36): Every 1px divider, panel border, and empty-state dash.
- **Pressed** (#eaeef2; dark #1f2630): Pressed state of a row or receipt-add tile.
- **Scrim** (rgba(13,17,23,0.45); dark rgba(1,4,9,0.7)): Behind sheets and alerts.
- **Selection** (rgba(9,105,218,0.22); dark rgba(121,192,255,0.3)): Text selection.
- **Translucent Ground** (rgba(246,248,250,0.92); dark rgba(13,17,23,0.9)): Tab bar background where backdrop blur is supported.

### Named Rules
**The State Is The Colour Rule.** Colour names a state (actionable, sent, changed, destructive) or a subject. A decorative accent does not exist in this system.

**The One Seam Rule.** Panels are separated by a 1px seam at the hairline width (0.5px on 2x screens), never by a shadow or a second colour.

## Typography

**Display and Figure Font:** SF Mono via `ui-monospace` (fallbacks: 'SF Mono', SFMono-Regular, Menlo, monospace).
**Body Font:** the system UI face via `-apple-system` (fallbacks: BlinkMacSystemFont, system-ui, sans-serif).
**Label Font:** the body face, uppercased and tracked for group and stage labels.

**Character:** The system face keeps every label and control native to iOS. The monospace is the ledger's voice: it sets the large titles and every measured value, so a time or an hour reads as a figure, not as prose.

### Hierarchy
- **Display** (600, 34px, line-height 1.2, letter-spacing -0.03em, mono): Tab roots only: "Log", "Sessions", "Summaries", "People", "Settings". The Log title is followed by a 13px date line in the body face.
- **Heading** (600, 17px, line-height 1.3): Panel titles inside a screen, sheet and alert titles, nav titles, empty-state headings, and a family name used as a group header (the `name` variant at 17px, no caps).
- **Body** (400, 17px, line-height 1.3): Row labels, segment labels, text fields, the Turkish message box, and the default text across the app. Note that `html, body` sets 17px.
- **Metric** (400, 20px, line-height 1.2, mono, tabular): The value in each cell of a metric strip (Start, Finish, Duration, Lesson, Activity, Travel totals). Unset values fall back to 15px body face in muted ink.
- **Label** (400, 13px, line-height 1.3): Row sub-lines, footers, captions, status text, the session meta line, the amount column of a session row (12px), and the tab label (13px; 12px on 320px screens).
- **Group Label** (600, 12px, line-height 1.3, letter-spacing 0.08em, uppercase, muted ink): Section headers above a panel and metric labels inside a strip. Its tracked caps carry no decoration.

### Named Rules
**The Figures Are Mono Rule.** Any value measured in time, minutes, hours or money sets in the monospaced face with tabular numerals. Labels and words never do.

**The Tracked Label Rule.** Uppercase tracking is used only on the label of a panel or a metric cell, in muted ink, and nowhere else.

## Layout

The app is one column: 560px wide on phones and tablets portrait, 800px on desktop (960px and up), where the tab bar becomes a 200px left rail. Below 600px the column fills the screen; at 600px and above the column carries a 1px seam on each side.

Screens are absolutely positioned layers: a screen is inset 0 under a 44px nav bar (plus the safe-area top), a scroll container fills it, and a tab bar (48px plus the safe-area bottom) is fixed at the bottom. Sheets start 8px below the safe-area top. Pushed screens slide over the screen and keep the tab bar visible.

Panels (grouped sections) sit 16px in from the screen edge on each side. Consecutive sections are separated by 32px; a destructive section is set 48px clear of what comes before. The docked action footer (Log Session, Send) sits above the tab bar with a 24px fade into the content.

Spacing rhythm: the scale is 4, 8, 16, 24, 32, 48px. Row padding is 12px vertical, which is the one off-scale value used throughout; metric cells use 10px and 12px. Do not invent a new step to match them.

Narrow phones (under 360px): metric figures drop from 20px to 17px, the tab label drops to 12px, and horizontal cell padding drops to 10px. Those are the only breakpoints that change content size.

## Elevation & Depth

Flat. Depth is conveyed by a tonal step (Raised Panel over Panel Surface over Graphite Ground) and by 1px seams. Panels, rows, chips, and buttons carry no shadow. The one shadow at rest is the ambient lift on sheets and alerts over the scrim; see the drift note below.

### Shadow Vocabulary
None are canonized. The build carries two (see the drift note).

### Named Rules
**The Flat-At-Rest Rule.** A panel, row, cell or control gets no shadow. Its depth is the tonal step and the seam.

**The Seam Not Shadow Rule.** A divider is a 1px line in Seam colour, not a drop shadow.

## Shapes

Two radii and one zero: 8px for panels and the summary checklist, 6px for buttons, segmented controls, tiles and the destructive outline, and 0 for the Turkish message box, which runs edge to edge in its panel. Inputs are borderless text in the row. Corners on a segmented control round only the outside segments. The skeleton bar uses 2px.

Borders are 1px in Seam, or 1px in Destructive for the destructive outline and the records error. Dashed Seam borders mark an empty state. Nothing is clipped except panels (overflow hidden at 8px) and receipt thumbnails (6px).

## Components

### Buttons
- **Shape:** 6px corners (`radius-segment`), minimum height 44px.
- **Primary:** Blue fill with ink-on-accent text (#ffffff), 600 weight, 0 24px padding. Used once per screen, docked above the tab bar where it is the main action (Log Session, Send).
- **Pressed / Disabled:** Pressed drops opacity to 0.5. Disabled drops opacity to 0.5 on the primary button; a disabled Save text button turns muted ink.
- **Secondary:** Raised Panel fill with a 1px Seam border, blue 600-weight text, 16px horizontal padding. Used beside a primary button in a footer.
- **Destructive:** Transparent fill, 1px Destructive Red outline, Destructive text at 600 weight, full width, with 24px clear space above and below, never inside a panel.

### Text Buttons
Blue 17px text, 44px minimum tap area, 16px horizontal padding. Opacity 0.5 on press. Used for nav actions (Cancel, Save), group header actions, and inline controls like Clear.

### Panels (Groups)
- **Corner Style:** 8px radius, overflow hidden.
- **Background:** Panel Surface, sitting on the Graphite Ground.
- **Border:** 1px Seam all round.
- **Header:** Group Label above the panel, 0 16px 8px padding. Name headers (family names) are Heading at 17px, not caps.
- **Footer:** 13px muted ink, 8px above, 16px side padding. Errors in Destructive.
- **Internal Padding:** None on the panel itself; rows and metric cells carry their own 12px or 10px padding.

### Rows
- **Style:** 44px minimum height, 12px 16px padding, Seam divider between rows (not after the last), Ink label, muted value on the right.
- **Pressed:** Pressed Ground fill. Chevron (12px, muted) for navigation rows.
- **Tones:** Accent (blue text) for actions, Secondary (muted text) for sub-state, Destructive (outlined, separate). Banner rows use a Raised Panel fill with a Changed Amber label.

### Metric Strip
The signature grid for measured values: three equal cells divided by 1px seams, each cell holding a Group Label above a 20px mono value. A Start, Finish, Duration, or Activity cell is a live input; a Lesson cell is derived and muted. Cells gain Raised Panel fill and a 2px blue inset outline when focused. The strip is the Log tab's and totals' only layout for numbers.

### Segmented Control
- **Shape:** 6px radius, 32px height, 1px inset Seam ring, Panel Surface fill.
- **Selected:** Raised Panel fill, blue 600-weight text, 1px inset blue ring.
- **Tap area:** 44px through an invisible extension.

### Inputs
- **Style:** No box. Text sits in a row at 17px body face with the label column (88px, or 96px for Description) to its left.
- **Focus:** A 2px blue outline inset 2px around the row (or the strip cell).
- **Placeholder:** Muted ink.
- **Error:** The label and value turn Destructive; a caption in Destructive below.

### Send Checklist (signature)
- **Shape:** One 8px-radius panel divided into three equal stage cells by 1px seams, with a line through the seams joining the glyphs.
- **Stages:** Check, Message, Sent. Each shows a 20px drawn status glyph: check in a ring (done, green), triangle with a bar (attention, amber), dot in a ring (idle, muted), 2px stroke throughout.
- **Detail:** 15px text under the title, coloured by tone (done in ink, attention in amber, idle in muted).
- **Mini form:** On Summaries rows, the same three glyphs at 16px inline, with the words in the accessible label.
- **Motion:** The panel opens along one axis (height) at 200ms ease-out when expanded.

### Navigation
- **Nav bar:** 44px plus the safe-area top, Panel Surface fill, 17px semibold centred title, text buttons at the sides. A 1px Seam line appears once content scrolls beneath it.
- **Tab bar:** Five equal tabs at the bottom (a left rail on desktop). Graphite fill with backdrop blur where supported, 1px Seam top border. Each tab is a 24px line icon over a 13px label in muted ink; the active tab is blue with a 2px blue bar at its top edge (on desktop, a Raised Panel row).

### Empty and Loading States
- **Empty:** A dashed 1px Seam panel, 8px radius, 24px 16px padding, a Heading and a muted line of text of up to 36ch.
- **Loading:** A panel of three 12px Raised Panel bars at 16px margins, pulsing between 0.5 and 1 opacity over 1.4s.

### Sheets, Pushed Screens, Alerts
- **Sheet:** 8px top corners, Graphite Ground, a 1px Seam nav bar with Cancel and Save, rises over a Scrim in 350ms.
- **Pushed screen:** Slides in from the right over 300ms (150ms cross-fade under reduced motion).
- **Alert:** 300px wide (or the screen minus 24px), Raised Panel fill, 8px corners, a Heading title, a 15px muted message, and full-width 44px buttons divided by seams.

### Receipts
A 72px grid of 6px-radius tiles. A tile holds a photo over a Raised Panel background with a 1px Seam border. The Add Photo tile is a 1px dashed blue border. The receipt viewer is black in both modes.

## Do's and Don'ts

### Do:
- **Do** use Actionable Blue only for something the instructor can press, and Sent Green, Changed Amber, Destructive Red only for their state.
- **Do** set every measured value (a time, minute, hour, or amount) in the mono face with tabular figures.
- **Do** separate panels with a 1px Seam and a tonal step, not a shadow or a second colour.
- **Do** keep destructive actions as an outlined button set 24px clear of other controls, never inside a panel.
- **Do** keep the send checklist derived from stored state, and use the same three stages on the family summary and on the Summaries row.
- **Do** limit motion to panels expanding along one axis and to sheets and pushed screens sliding in; respect reduced motion.

### Don't:
- **Don't** add a shadow to a panel, row, chip, or control. The only permitted lift is the existing overlay on a sheet or alert (see the drift note).
- **Don't** use colour decoratively. Colour names a state or a subject; no accent exists for ornament.
- **Don't** add a decorative icon, kicker, or eyebrow above a heading. The tab icons and the send checklist glyphs are the only drawn icons, and each names a function or a state.
- **Don't** use the system display face for titles; titles use the monospace, as the Log, Sessions, Summaries, People and Settings tabs do.
- **Don't** add a new spacing step, radius, or type size to match a one-off; use the scale and the observed sizes (34, 20, 17, 15, 13, 12px).
- **Don't** set a monospace face on labels or words; it is for figures and the display title only.

### Drift and not canonized
- The sheet (`0 -8px 28px rgba(0,0,0,0.28)`) and the alert (`0 12px 32px rgba(0,0,0,0.35)`) carry box-shadows; the world says no shadows. Recorded as drift, not as the system's elevation.
- The receipt viewer background is a hardcoded `#000000`, and the sheet and alert shadows use hardcoded `rgba(0,0,0,…)`. Not tokenised.
- Group labels and stage titles are tracked uppercase; the build has no separate kicker or eyebrow element. Recorded, not extended.
