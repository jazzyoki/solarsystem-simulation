const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // J2000
const MS_PER_DAY = 86_400_000;

/** Formats J2000 + simDays as YYYY-MM-DD (UTC). */
export function formatSimDate(simDays: number): string {
  const d = new Date(EPOCH_MS + simDays * MS_PER_DAY);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
