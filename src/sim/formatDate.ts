const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const MS_PER_DAY = 86_400_000;

/** Formats 2026-01-01 00:00 UTC + simDays as YYYY-MM-DD. */
export function formatSimDate(simDays: number): string {
  const d = new Date(EPOCH_MS + simDays * MS_PER_DAY);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
