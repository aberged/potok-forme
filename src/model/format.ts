// Dates, times and sizes in the frame's language. Bare "sr" in Intl is
// Cyrillic, so Latin Serbian asks for "sr-Latn", as Potok's page does.

export function locale(lang: string): string {
  if (lang === 'en') return 'en-GB';
  return lang === 'sr-Cyrl' ? 'sr-Cyrl' : 'sr-Latn';
}

export function moment(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** A date answer: "2026-11-08", "11-08" without a year, or with "T14:30". */
export function dateAnswer(value: string, withYear: boolean, withTime: boolean, lang: string): string {
  const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year ?? 2000), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0)));
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', timeZone: 'UTC' };
  if (withYear && year) options.year = 'numeric';
  if (withTime && hour) Object.assign(options, { hour: '2-digit', minute: '2-digit' });

  return new Intl.DateTimeFormat(locale(lang), options).format(date);
}

export function bytes(size: number, lang: string): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

export function number(value: number, lang: string, digits = 1): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(value);
}

/** A datetime-local input's value for an ISO moment, in the viewer's zone. */
export function localInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** An ISO moment with the viewer's zone from a datetime-local input's value. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
