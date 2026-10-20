import { describe, expect, it } from 'vitest';
import { formatHours, formatHoursTr, hoursParts } from '../src/domain/hours';
import { foldTurkishAscii, formatPeriodLabelTr, formatSessionDateTr, SUBJECT_TR } from '../src/domain/turkish';

describe('formatHoursTr (D-02, SUM-03)', () => {
  it.each([
    [0, '0 saat (0:00)'],
    [15, '0,25 saat (0:15)'],
    [23, '0,38 saat (0:23)'],
    [45, '0,75 saat (0:45)'],
    [60, '1 saat (1:00)'],
    [90, '1,5 saat (1:30)'],
    [105, '1,75 saat (1:45)'],
    [999, '16,65 saat (16:39)'],
  ])('%s min reads %s', (minutes, text) => expect(formatHoursTr(minutes)).toBe(text));

  it('shares one rounding core with formatHours for every whole minute 0 to 999', () => {
    for (let m = 0; m <= 999; m++) {
      expect(formatHoursTr(m)).toBe(formatHours(m).replace('.', ',').replace(' h ', ' saat '));
    }
  });

  it('hoursParts returns whole, trimmed frac and h:mm', () => {
    expect(hoursParts(90)).toEqual({ whole: 1, frac: '5', hm: '1:30' });
    expect(hoursParts(60)).toEqual({ whole: 1, frac: '', hm: '1:00' });
    expect(hoursParts(15)).toEqual({ whole: 0, frac: '25', hm: '0:15' });
  });
});

describe('turkish labels (D-01, D-04)', () => {
  it('formats a session date weekday first', () => {
    expect(formatSessionDateTr('2026-10-12')).toBe('Pzt 12 Eki');
    expect(formatSessionDateTr('2026-10-14')).toBe('Çar 14 Eki');
  });

  it('reads the seven weekdays from Monday', () => {
    const days = ['12', '13', '14', '15', '16', '17', '18'].map((d) => formatSessionDateTr(`2026-10-${d}`).split(' ')[0]);
    expect(days).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
  });

  it('formats period labels', () => {
    expect(formatPeriodLabelTr('week', { start: '2026-10-12', end: '2026-10-18' })).toBe('12–18 Ekim 2026');
    expect(formatPeriodLabelTr('week', { start: '2026-09-28', end: '2026-10-04' })).toBe('28 Eylül – 4 Ekim 2026');
    expect(formatPeriodLabelTr('week', { start: '2026-12-28', end: '2027-01-03' })).toBe('28 Aralık 2026 – 3 Ocak 2027');
    expect(formatPeriodLabelTr('month', { start: '2026-10-01', end: '2026-10-31' })).toBe('Ekim 2026');
  });

  it('maps subjects', () => {
    expect(SUBJECT_TR.swim).toBe('Yüzme');
    expect(SUBJECT_TR.math).toBe('Matematik');
  });

  it('folds Turkish letters to ASCII before lowercasing', () => {
    expect(foldTurkishAscii('İş Ağı Öğrenci')).toBe('Is Agi Ogrenci');
    expect(foldTurkishAscii('ŞşĞğİıÇçÖöÜü')).toBe('SsGgIiCcOoUu');
    expect(foldTurkishAscii('Smith')).toBe('Smith');
  });
});
