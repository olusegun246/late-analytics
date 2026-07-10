// ============================================================
//  Date helpers for the biweekly (14-day) pay period.
//  Ported from the original tracker, with one important fix:
//  the original used toISOString().slice(0,10), which converts
//  to UTC and can shift the date by a day depending on timezone.
//  toDateStr() below uses the LOCAL calendar date instead.
// ============================================================

export const PERIOD_LENGTH_DAYS = 14;

// Jul 6 2026 is a Monday and marks the start of a real pay period.
// (Month is 0-indexed, so 6 = July.) Every period is aligned to this.
const ANCHOR = new Date(2026, 6, 6);

/** 'YYYY-MM-DD' from a Date, using its LOCAL calendar day (no UTC shift). */
export function toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Build a Date from a 'YYYY-MM-DD' string using the LOCAL calendar day.
 * This is the inverse of toDateStr(). Using the (y, m, d) constructor
 * avoids new Date('2026-07-06') — that parses as UTC midnight and can
 * land on the previous day once the browser shifts it to local time.
 */
export function fromDateStr(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

export function isWeekend(d: Date): boolean {
    const day = d.getDay();
    return day === 0 || day === 6;
}

/** The Monday that starts the pay period containing today. */
export function getCurrentPeriodStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Monday of the current week
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7));

    // Which half of the 2-week cycle are we in? Step back a week if needed.
    const diffWeeks = Math.floor(
        (monday.getTime() - ANCHOR.getTime()) / (7 * 86_400_000)
    );
    const offset = ((diffWeeks % 2) + 2) % 2; // always 0 or 1, even for past dates
    monday.setDate(monday.getDate() - offset * 7);
    return monday;
}

/** The 14 Date objects of a period, starting at `start`. */
export function getPeriodDays(start: Date): Date[] {
    return Array.from({ length: PERIOD_LENGTH_DAYS }, (_, i) => addDays(start, i));
}

export function getPeriodLabel(start: Date): string {
    const end = addDays(start, PERIOD_LENGTH_DAYS - 1);
    const opts: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString(
        'en-US',
        opts
    )}`;
}

/** Work days (Mon–Fri) in the period that are today or later. */
export function getWorkDaysRemaining(start: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getPeriodDays(start).filter((d) => !isWeekend(d) && d >= today).length;
}