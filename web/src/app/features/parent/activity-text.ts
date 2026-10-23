const time = new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Reads a PocketBase date (`2026-10-23 12:05:00.000Z`) or an ISO date; null when unreadable. */
export function parseDate(value: string): Date | null {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * A moment as the parent reads it, in the time of the device: "vandaag om 14:05", "gisteren om
 * 9:12", "12 oktober om 14:05", or with the year when it is another year ("3 december 2025 om
 * 10:00"). An unreadable date gives "onbekend".
 */
export function activityText(updated: string, now: Date): string {
  const date = parseDate(updated);
  if (!date) return 'onbekend';
  const at = time.format(date);
  if (sameDay(date, now)) return `vandaag om ${at}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) return `gisteren om ${at}`;
  const day = date.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear;
  return `${day.format(date)} om ${at}`;
}
