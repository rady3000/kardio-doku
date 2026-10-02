import { describe, expect, it } from 'vitest';
import { formatGermanDate, parseGermanDate, todayIso } from '../../src/shared/dates';

describe('German date entry', () => {
  it.each([
    ['01.02.1950', '1950-02-01'],
    ['1.2.1950', '1950-02-01'],
    ['01021950', '1950-02-01'],
    ['1950-02-01', '1950-02-01'],
    [' 29.02.2024 ', '2024-02-29'],
  ])('parses %s', (input, iso) => expect(parseGermanDate(input)).toBe(iso));

  it.each(['31.02.2020', '29.02.2023', '01.13.2000', '1.2.50', '', 'abc', '00.01.2000', '01.01.1899'])(
    'rejects %s',
    (input) => expect(parseGermanDate(input)).toBeNull(),
  );

  it('formats ISO as TT.MM.JJJJ', () => {
    expect(formatGermanDate('1950-02-01')).toBe('01.02.1950');
    expect(formatGermanDate(null)).toBe('');
  });

  it('gives today in local time', () => {
    expect(todayIso(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
  });
});
