import { describe, expect, it } from 'vitest';
import { dateInputToSimDays, formatSimDate, timestampToSimDays } from './formatDate';

describe('formatSimDate', () => {
  it('formats the epoch as 2026-01-01', () => {
    expect(formatSimDate(0)).toBe('2026-01-01');
  });

  it('advances one calendar day per sim day', () => {
    expect(formatSimDate(1)).toBe('2026-01-02');
  });

  it('rolls over months', () => {
    expect(formatSimDate(31)).toBe('2026-02-01');
  });

  it('handles the 2028 leap day', () => {
    expect(formatSimDate(789)).toBe('2028-02-29');
    expect(formatSimDate(1096)).toBe('2029-01-01');
  });

  it('starts at midnight, so the date flips after a whole simulated day', () => {
    expect(formatSimDate(0.999)).toBe('2026-01-01');
    expect(formatSimDate(1)).toBe('2026-01-02');
  });

  it('handles large values', () => {
    expect(formatSimDate(10000)).toBe('2053-05-19');
  });
});

describe('dateInputToSimDays', () => {
  it('maps the epoch date to 0', () => {
    expect(dateInputToSimDays('2026-01-01')).toBe(0);
  });

  it('maps the next day to 1', () => {
    expect(dateInputToSimDays('2026-01-02')).toBe(1);
  });

  it('handles the 2028 leap day', () => {
    expect(dateInputToSimDays('2028-02-29')).toBe(789);
  });

  it('is the inverse of formatSimDate', () => {
    for (const days of [0, 1, 31, 789, 1096, 10000]) {
      expect(dateInputToSimDays(formatSimDate(days))).toBe(days);
    }
  });

  it('produces negative offsets for dates before the epoch', () => {
    expect(dateInputToSimDays('2025-12-31')).toBe(-1);
  });
});

describe('timestampToSimDays', () => {
  it('maps the epoch instant to 0', () => {
    expect(timestampToSimDays(Date.UTC(2026, 0, 1, 0, 0, 0))).toBe(0);
  });

  it('floors to the UTC day (later time same day still maps to that day)', () => {
    expect(timestampToSimDays(Date.UTC(2026, 0, 1, 23, 59, 59))).toBe(0);
  });

  it('maps a known day to its offset', () => {
    // 2026-07-21 is 201 days after 2026-01-01.
    expect(timestampToSimDays(Date.UTC(2026, 6, 21, 12, 0, 0))).toBe(201);
    expect(formatSimDate(201)).toBe('2026-07-21');
  });

  it('produces a negative offset for an instant before the epoch', () => {
    expect(timestampToSimDays(Date.UTC(2025, 11, 31, 12, 0, 0))).toBe(-1);
  });
});
