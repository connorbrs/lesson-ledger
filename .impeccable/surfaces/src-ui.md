---
version: 1
slug: "src-ui"
primary_target: "src/ui"
related_targets: ["src/ui/styles.css"]
---

# Lesson Ledger app UI (all tabs)

Scope: the whole app UI (Log, Sessions, Summaries + Family Summary, People, Settings, sheets, alerts). Mode: Operate.
Audience/job: one instructor catching up on sessions in the evening, sitting down; reviewing hours; sending Turkish summaries to parents.
Constraints: keep every feature, data rule and copy string; iOS behaviour (tab bar, sheets, share sheet); must not be playful, hard to read at night, or slower. Log stays the home tab.
Chosen direction: Graphite Console (catalog challenger), fused with the product.
Memorable moment: the send checklist on each family's summary.

## Direction contract

THESIS: A graphite working ledger where state is the only colour; it refuses the iOS-settings grey grouped list with one tint everywhere.
OWN-WORLD: Graphite ground, panels one elevation step up divided by 1px seams, no shadows. Text near-white, muted grey labels in tracked small caps. Figures in a monospaced tabular face. Accents only for state: blue = actionable, green = sent/done, amber = warning/changed, red = destructive (outline, isolated by space). Swim cyan and Math violet as subject tags. Light theme mirrors it on cool paper.
STORY: The instructor sees what was logged, what needs checking and what is sent, at a glance, then acts with standard controls.
FIRST VIEWPORT: Log tab. Large title with today's date line; one Session panel (Start/Finish/Duration as a 3-cell mono strip, Subject, Students), one Minutes panel (Lesson/Activity/Travel 3-cell mono strip), expenses below; primary Log Session button docked above the tab bar; tab bar graphite with blue active state.
FORM: Graphite Console challenger (dealt alternate, chosen by user); seed:145ac4e3217a2b94. Signature move: send checklist strip (Checked → Message → Sent) built from stored state, on Family Summary and as mini dots on Summaries rows; motion is panels expanding along one axis.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
