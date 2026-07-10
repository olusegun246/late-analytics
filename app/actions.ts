'use server';

// ============================================================
//  Server actions — everything that touches the database.
//  These run ONLY on the server, so the DB connection is never
//  exposed to the browser. The client calls these like functions.
// ============================================================

import { sql } from '@/lib/db';
import type { Employee, LatenessRecord } from '@/lib/types';

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
               count
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
 * lateness history rather than destroying it (unlike the original).
 */
export async function deleteEmployee(id: number): Promise<void> {
    await sql`UPDATE employees SET active = false WHERE id = ${id}`;
}

/**
 * Set the tally for one employee on one day (an upsert).
 * A count of 0 or less removes the row entirely.
 */
export async function setTally(
    employeeId: number,
    dateStr: string,
    count: number
): Promise<void> {
    if (count <= 0) {
        await sql`
            DELETE FROM lateness_records
            WHERE employee_id = ${employeeId} AND date = ${dateStr}
        `;
    } else {
        await sql`
            INSERT INTO lateness_records (employee_id, date, count)
            VALUES (${employeeId}, ${dateStr}, ${count})
            ON CONFLICT (employee_id, date)
            DO UPDATE SET count = ${count}
        `;
    }
}

/** Wipe all records for a date range (the "Reset Period" button). */
export async function resetPeriod(startStr: string, endStr: string): Promise<void> {
    await sql`
        DELETE FROM lateness_records
        WHERE date >= ${startStr} AND date <= ${endStr}
    `;
}
