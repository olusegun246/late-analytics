export interface Employee {
    id: number;
    name: string;
    active: boolean;
}

// The three kinds of lateness we track.
export type LatenessType = 'work' | 'to_lunch' | 'from_lunch';

// One row = one type of lateness that happened on one day.
export interface LatenessRecord {
    employee_id: number;
    date: string; // 'YYYY-MM-DD'
    type: LatenessType;
}

// Display metadata for each type: label shown in the menu, dot color,
// and a single letter used in the CSV export.
export const LATENESS_TYPES: {
    type: LatenessType;
    label: string;
    color: string;
    letter: string;
}[] = [
    { type: 'work', label: 'Work', color: '#f59e0b', letter: 'W' },
    { type: 'to_lunch', label: 'To Lunch', color: '#3b82f6', letter: 'L' },
    { type: 'from_lunch', label: 'From Lunch', color: '#ef4444', letter: 'B' },
];
