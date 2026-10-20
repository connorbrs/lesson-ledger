// Developer tool, not part of the app or dist: writes a valid synthetic Lesson Ledger backup (schemaVersion 2)
// of about the given size, for the on-device check of the 150 MB limit (task 3 of plan 03-05).
//
//   node scripts/make-large-backup.mjs <size in MB> <output file>
//
// Size is in decimal megabytes (1 MB = 1,000,000 bytes), the same unit as the app's 150 MB cap, so 140 restores
// and 151 is refused. Each photo entry starts with the JPEG signature FF D8 FF E0 followed by deterministic
// pseudo-random bytes: it passes the restore validator but is NOT a viewable image.
import { writeFileSync } from 'node:fs';

const usage = 'Usage: node scripts/make-large-backup.mjs <size in MB> <output file>';
const [sizeArg, outPath] = process.argv.slice(2);
const megabytes = Number(sizeArg);
if (!sizeArg || !outPath || !Number.isFinite(megabytes) || megabytes <= 0) {
  console.error(usage);
  process.exit(1);
}

const now = Date.now();
const familyId = 'synthetic-family';
const studentId = 'synthetic-student';
const sessionId = 'synthetic-session';
const EXPENSES = 5;
const TARGET_PHOTO_BYTES = 400 * 1024;

const expenses = Array.from({ length: EXPENSES }, (_, i) => ({
  id: `synthetic-expense-${i + 1}`,
  sessionId,
  description: `Synthetic expense ${i + 1}`,
  amountCents: 1000 + i,
  splits: [{ familyId, cents: 1000 + i }],
  createdAt: now,
  updatedAt: now,
}));

const base = {
  format: 'lesson-ledger-backup',
  schemaVersion: 2,
  createdAt: now,
  families: [{ id: familyId, name: 'Synthetic Family', period: 'weekly', archivedAt: null, createdAt: now, updatedAt: now }],
  students: [
    { id: studentId, familyId, name: 'Synthetic Student', defaultSubject: 'swim', notes: '', archivedAt: null, createdAt: now, updatedAt: now },
  ],
  sessions: [
    {
      id: sessionId, date: '2026-10-19', startTime: null, endTime: null, subject: 'swim',
      attendees: [{ studentId, familyId }], credits: [{ familyId, lesson: 'full', activity: 'full' }],
      lessonMinutes: 60, activityMinutes: 0, travelMinutes: 0, createdAt: now, updatedAt: now,
    },
  ],
  expenses,
  attachments: [],
};

const target = Math.round(megabytes * 1_000_000);
const overhead = JSON.stringify(base).length;
const perPhotoEncoded = Math.ceil(TARGET_PHOTO_BYTES / 3) * 4;
const count = Math.max(1, Math.round((target - overhead) / (perPhotoEncoded + 150)));
// Whole base64 groups (a multiple of 3 bytes) so there is no padding, then spread the remaining size evenly.
const photoBytes = Math.max(3, Math.floor((((target - overhead) / count - 150) * 3) / 4 / 3) * 3);

function photo(index) {
  const bytes = Buffer.alloc(photoBytes);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  let x = (index + 1) * 2654435761 >>> 0;
  for (let i = 4; i < photoBytes; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    bytes[i] = x & 0xff;
  }
  return {
    id: `synthetic-photo-${String(index + 1).padStart(4, '0')}`,
    expenseId: expenses[index % EXPENSES].id,
    mime: 'image/jpeg',
    width: 1200,
    height: 1600,
    createdAt: now,
    data: bytes.toString('base64'),
  };
}

base.attachments = Array.from({ length: count }, (_, i) => photo(i));
const text = JSON.stringify(base);
writeFileSync(outPath, text);
console.log(`Wrote ${Buffer.byteLength(text)} bytes (${count} photo entries) to ${outPath}`);
