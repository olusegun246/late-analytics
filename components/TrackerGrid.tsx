'use client';

import type { Employee } from '@/lib/types';
import { toDateStr, isWeekend } from '@/lib/dates';

function lateClass(n: number) {
    if (n === 1) return ' late-1';
    if (n === 2) return ' late-2';
    if (n === 3) return ' late-3';
    if (n >= 4) return ' late-4-plus';
    return '';
}

export default function TrackerGrid({
    employees,
    days,
    getCount,
    empTotal,
    selectedId,
    onCell,
}: {
    employees: Employee[];
    days: Date[];
    getCount: (empId: number, dateStr: string) => number;
    empTotal: (empId: number) => number;
    selectedId: number | null;
    onCell: (empId: number, dateStr: string, delta: number) => void;
}) {
    const dayTotals = days.map((d) =>
        employees.reduce((sum, e) => sum + getCount(e.id, toDateStr(d)), 0)
    );
    const grandTotal = dayTotals.reduce((a, b) => a + b, 0);

    return (
        <table className="grid-table">
            <thead>
                <tr>
                    <th>Employee</th>
                    {days.map((d) => {
                        const wknd = isWeekend(d);
                        return (
                            <th key={toDateStr(d)} className={wknd ? 'weekend' : ''}>
                                {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                <br />
                                <span style={{ fontSize: 9, fontWeight: 400 }}>
                                    {d.getMonth() + 1}/{d.getDate()}
                                </span>
                            </th>
                        );
                    })}
                    <th style={{ background: '#fafbfc' }}>Total</th>
                </tr>
            </thead>
            <tbody>
                {employees.map((emp) => {
                    const total = empTotal(emp.id);
                    return (
                        <tr
                            key={emp.id}
                            style={
                                selectedId === emp.id
                                    ? { background: '#edeffd' }
                                    : undefined
                            }
                        >
                            <td>{emp.name}</td>
                            {days.map((d) => {
                                const dateStr = toDateStr(d);
                                if (isWeekend(d)) {
                                    return (
                                        <td key={dateStr}>
                                            <span
                                                className="tally-cell weekend-cell"
                                                title={`${dateStr} — Weekend`}
                                            >
                                                —
                                            </span>
                                        </td>
                                    );
                                }
                                const n = getCount(emp.id, dateStr);
                                return (
                                    <td key={dateStr}>
                                        <button
                                            className={`tally-cell${lateClass(n)}`}
                                            title={`${emp.name} — ${dateStr}: ${n} late(s)`}
                                            onClick={() => onCell(emp.id, dateStr, 1)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                onCell(emp.id, dateStr, -1);
                                            }}
                                        >
                                            {n === 0 ? '' : n}
                                        </button>
                                    </td>
                                );
                            })}
                            <td style={{ fontWeight: 700, padding: 4 }}>
                                <span
                                    className={`tally-cell${lateClass(total)}`}
                                    style={{ cursor: 'default' }}
                                >
                                    {total || ''}
                                </span>
                            </td>
                        </tr>
                    );
                })}

                <tr className="total-row">
                    <td>📊 Daily Totals</td>
                    {days.map((d, i) =>
                        isWeekend(d) ? (
                            <td key={toDateStr(d)} style={{ color: '#d1d5db' }}>
                                —
                            </td>
                        ) : (
                            <td key={toDateStr(d)}>{dayTotals[i] || ''}</td>
                        )
                    )}
                    <td>{grandTotal || ''}</td>
                </tr>
            </tbody>
        </table>
    );
}
