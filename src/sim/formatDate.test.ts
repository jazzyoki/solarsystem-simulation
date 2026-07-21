import { describe, expect, it } from 'vitest';
import { formatSimDate } from './formatDate';

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
