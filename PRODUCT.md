# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(An installable home-screen web app (PWA) on iPhone, opened from Safari's Add to Home Screen. It is not a native app, but iOS conventions shape what feels right.)

## Users

One user: a private swim instructor who also tutors secondary-school math one-on-one. They log their own sessions and send hour summaries to the students' parents, who pay from those hours.

They usually log **later, sitting down**, catching up on the day's sessions, rather than poolside right after each one. Logging should still be fast, but it is done with attention and time to type, not one-handed in a rush.

Secondary audience: **parents**, who never use the app. They receive its output: a Turkish text message and a Turkish PDF with receipt photos.

## Product Purpose

The app records time spent with students and turns it into correct per-family summaries that are ready to send.

Each session splits into lesson time and activity time, which families are billed for at different rates, plus travel time, which is for the instructor only. Activity expenses carry receipt photos.

Success means the weekly or monthly summary for each family is right without rechecking: lesson and activity separated, shared sessions credited correctly, and expenses and receipts included.

## Positioning

It is a personal ledger built around one instructor's real billing rules:
- Two-family swim sessions get per-family Full or Half credit for lesson and activity separately. Half rounds up to a whole minute.
- Shared expenses split exactly to the cent.
- Travel never reaches parents.
- Output is the parents' language (Turkish), ready to paste or share.

It tracks hours only. Parents compute payment themselves.

## Operating Context

- **Day-to-day:**
  - Log sessions in the Log tab.
  - Review them by week or month in Sessions, where the instructor's own totals live (lesson, activity and travel, by student, family and subject).
  - Open a family in Summaries for its last complete week or month.
- **Sending to parents:**
  - Edit and save the Turkish message, then copy it into Messages.
  - Share the PDF through the iOS share sheet.
  - Mark the period as sent. Later edits flag it as "changed since sent".
- **Backup:** data lives only on the phone, so manual backup to Files or iCloud matters. Restore replaces everything.

## Capabilities and Constraints

- Works fully offline after first load. No backend, no account, no network calls. $0 cost, hosted on GitHub Pages.
- Data is stored in IndexedDB on the device, including receipt photos (downscaled JPEGs).
- Backup is one JSON file (schemaVersion 3) sent through the share sheet. Older versions still restore, and the cap is 150 MB.
- App screens are in **English**. Everything parents see is in **Turkish**:
  - hours as "1,5 saat (1:30)";
  - amounts as "$12.50";
  - Turkish dates;
  - subjects as Yüzme and Matematik.
- App screens show hours as "1.5 h (1:30)". Weeks run Monday to Sunday.
- Each family has its own weekly or monthly period. Swim sessions can have 1–2 students; math is always one-on-one.
- Out of scope: rates, money owed, invoicing, payment tracking, multiple users or devices, automated sending.

## Brand Commitments

- Name: **Lesson Ledger**.
- Voice toward parents: **personal and plain**. Texts and PDFs should read like a note from the instructor, not a business invoice or a formal statement.

## Evidence on Hand

There is no marketing content, no testimonials and no customers beyond the instructor. Real data exists only on the user's phone. Never invent families, students or figures in examples beyond clearly marked test data.

## Product Principles

1. **Correct before clever.** Billing figures must be exact and consistent across the screen, the message and the PDF.
2. **The instructor's words win.** Never overwrite text they edited. Warn instead, and let them choose.
3. **Nothing is lost.** Data stays on the phone, backups are explicit and complete, and destructive actions say exactly what goes.
4. **Native feel, no surprises.** iOS patterns the user already knows beat novel ones.
5. **Parents see only what's theirs.** No other family's data, and no travel.
