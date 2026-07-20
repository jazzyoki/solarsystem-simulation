import { describe, expect, it } from 'vitest';
import { formatSimDate } from './formatDate';

describe('formatSimDate', () => {
  it('formats the epoch as 2000-01-01', () => {
    expect(formatSimDate(0)).toBe('2000-01-01');
  });

  it('advances one calendar day per sim day', () => {
    expect(formatSimDate(1)).toBe('2000-01-02');
  });

  it('rolls over months', () => {
    expect(formatSimDate(31)).toBe('2000-02-01');
  });

  it('handles leap years (year 2000 had 366 days)', () => {
    expect(formatSimDate(366)).toBe('2001-01-01');
  });

  it('starts at noon, so the date flips at midday', () => {
    expect(formatSimDate(0.4)).toBe('2000-01-01');
    expect(formatSimDate(0.6)).toBe('2000-01-02');
  });

  it('handles large values', () => {
    expect(formatSimDate(10000)).toBe('2027-05-19');
  });
});
