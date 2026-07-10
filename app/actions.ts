'use server';

// ============================================================
//  Server actions — everything that touches the database.
//  These run ONLY on the server, so the DB connection is never
//  exposed to the browser. The client calls these like functions.
// ============================================================

import { sql } from '@/lib/db';
import type { Employee, LatenessRecord, LatenessType } from '@/lib/types';

/** All active employees, alphabetical. */
export async function getEmployees(): Promise<Employee[]> {
    const rows = await sql`
        SELECT id, name, active
        FROM employees
        WHERE active = true
        ORDER BY name ASC
    `;
    return rows as Employee[];
}

/** Lateness rows between two 'YYYY-MM-DD' dates (inclusive). */
export async function getLatenessForRange(
    startStr: string,
    endStr: string
): Promise<LatenessRecord[]> {
    const rows = await sql`
        SELECT employee_id,
               to_char(date, 'YYYY-MM-DD') AS date,
               type
        FROM lateness_records
        WHERE date >= ${startStr} AND date <= ${endStr}
    `;
    return rows as LatenessRecord[];
}

/** Add a new employee, returns the created row. */
export async function addEmployee(name: string): Promise<Employee> {
    const rows = await sql`
        INSERT INTO employees (name, active)
        VALUES (${name.trim()}, true)
        RETURNING id, name, active
    `;
    return rows[0] as Employee;
}

/** Rename an employee. History stays attached via employee_id. */
export async function updateEmployee(id: number, name: string): Promise<void> {
    await sql`UPDATE employees SET name = ${name.trim()} WHERE id = ${id}`;
}

/**
 * Soft-delete: mark inactive instead of deleting. This PRESERVES their
 * lateness history rather than destroying it.
 */
export async function deleteEmployee(id: number): Promise<void> {
    await sql`UPDATE employees SET active = false WHERE id = ${id}`;
}

/**
 * Turn one lateness type on or off for an employee on a day.
 *   on = true  -> record that this type happened (insert)
 *   on = false -> remove it (the "clicked by accident" undo)
 */
export async function toggleLate(
    employeeId: number,
    dateStr: string,
    type: LatenessType,
    on: boolean
): Promise<void> {
    if (on) {
        await sql`
            INSERT INTO lateness_records (employee_id, date, type)
            VALUES (${employeeId}, ${dateStr}, ${type})
            ON CONFLICT (employee_id, date, type) DO NOTHING
        `;
    } else {
        await sql`
            DELETE FROM lateness_records
            WHERE employee_id = ${employeeId}
              AND date = ${dateStr}
              AND type = ${type}
        `;
    }
}

// ============================================================
//  Employee Records feature — full-year, per-employee view
//  including removed (inactive) employees.
// ============================================================

/** Every employee — active AND removed — for the records directory. */
export async function getAllEmployees(): Promise<Employee[]> {
    const rows = await sql`
        SELECT id, name, active
        FROM employees
        ORDER BY active DESC, name ASC
    `;
    return rows as Employee[];
}

/** One employee's lateness rows for a whole calendar year. */
export async function getEmployeeYear(
    employeeId: number,
    year: number
): Promise<LatenessRecord[]> {
    const rows = await sql`
        SELECT employee_id,
               to_char(date, 'YYYY-MM-DD') AS date,
               type
        FROM lateness_records
        WHERE employee_id = ${employeeId}
          AND date >= ${`${year}-01-01`}
          AND date <= ${`${year}-12-31`}
        ORDER BY date ASC
    `;
    return rows as LatenessRecord[];
}

/** Per-employee counts for a year — one query feeds all directory badges. */
export async function getYearTotals(
    year: number
): Promise<{ employee_id: number; count: number }[]> {
    const rows = await sql`
        SELECT employee_id, COUNT(*)::int AS count
        FROM lateness_records
        WHERE date >= ${`${year}-01-01`}
          AND date <= ${`${year}-12-31`}
        GROUP BY employee_id
    `;
    return rows as { employee_id: number; count: number }[];
}