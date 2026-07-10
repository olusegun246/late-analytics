'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Employee, LatenessRecord, LatenessType } from '@/lib/types';
import { LATENESS_TYPES } from '@/lib/types';
import { COLORS } from '@/lib/colors';

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function initials(name: string) {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

// Parse a 'YYYY-MM-DD' string with the *local* Date constructor so we never
// hit the UTC-parsing pitfall that shifts the day by one.
function fmtDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function typeMeta(type: LatenessType) {
    return LATENESS_TYPES.find((t) => t.type === type)!;
}

export default function EmployeeRecords({
    employees,
    initialEmployeeId,
    directoryLoading = false,
    loadYear,
    loadYearTotals,
    onClose,
}: {
    employees: Employee[]; // ALL employees — active and removed
    initialEmployeeId: number | null;
    directoryLoading?: boolean;
    loadYear: (empId: number, year: number) => Promise<LatenessRecord[]>;
    loadYearTotals: (
        year: number
    ) => Promise<{ employee_id: number; count: number }[]>;
    onClose: () => void;
}) {
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [selectedId, setSelectedId] = useState<number | null>(initialEmployeeId);
    const [records, setRecords] = useState<LatenessRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [totals, setTotals] = useState<Record<number, number>>({});
    const [search, setSearch] = useState('');

    const selected = employees.find((e) => e.id === selectedId) ?? null;

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Directory badges: one aggregate query per year for every employee.
    useEffect(() => {
        let cancelled = false;
        loadYearTotals(year).then((rows) => {
            if (cancelled) return;
            const m: Record<number, number> = {};
            for (const r of rows) m[r.employee_id] = r.count;
            setTotals(m);
        });
        return () => {
            cancelled = true;
        };
    }, [year, loadYearTotals]);

    // Selected employee's full-year records.
    useEffect(() => {
        if (selectedId == null) {
            setRecords([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        loadYear(selectedId, year).then((r) => {
            if (cancelled) return;
            setRecords(r);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedId, year, loadYear]);

    const typeTotals = useMemo(() => {
        const t: Record<LatenessType, number> = {
            work: 0,
            to_lunch: 0,
            from_lunch: 0,
        };
        for (const r of records) t[r.type] = (t[r.type] ?? 0) + 1;
        return t;
    }, [records]);

    const monthCounts = useMemo(() => {
        const arr = Array<number>(12).fill(0);
        for (const r of records) arr[Number(r.date.slice(5, 7)) - 1]++;
        return arr;
    }, [records]);

    const maxMonth = Math.max(1, ...monthCounts);

    // Group each day's infractions so a single date shows all its type dots.
    const byDate = useMemo(() => {
        const m = new Map<string, LatenessType[]>();
        for (const r of records) {
            const list = m.get(r.date) ?? [];
            list.push(r.type);
            m.set(r.date, list);
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [records]);

    // Active employees first, then removed; filtered by the search box.
    const directory = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q
            ? employees.filter((e) => e.name.toLowerCase().includes(q))
            : employees;
        return [...list].sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }, [employees, search]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 500,
                background: 'rgba(15,23,42,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius, 16px)',
                    boxShadow: 'var(--shadow-lg)',
                    width: 'min(940px, 100%)',
                    height: 'min(680px, 90vh)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* ── header ── */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)',
                        flexShrink: 0,
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                        👥 Employee Records
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 600,
                            }}
                        >
                            <button
                                className="btn btn-ghost"
                                onClick={() => setYear((y) => y - 1)}
                                title="Previous year"
                                style={{ padding: '4px 10px' }}
                            >
                                ◀
                            </button>
                            <span style={{ minWidth: 48, textAlign: 'center' }}>
                                {year}
                            </span>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setYear((y) => y + 1)}
                                title="Next year"
                                disabled={year >= new Date().getFullYear()}
                                style={{ padding: '4px 10px' }}
                            >
                                ▶
                            </button>
                        </div>
                        <button
                            className="btn btn-ghost"
                            onClick={onClose}
                            title="Close"
                            style={{ padding: '4px 12px', fontSize: 16 }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── body: directory + detail ── */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    {/* directory */}
                    <div
                        style={{
                            width: 260,
                            borderRight: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{ padding: 12, borderBottom: '1px solid var(--border-light)' }}>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search employees…"
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    borderRadius: 'var(--radius-sm, 8px)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-alt, #f8fafc)',
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
                            {directoryLoading && (
                                <div
                                    style={{
                                        padding: 16,
                                        fontSize: 13,
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    Loading directory…
                                </div>
                            )}

                            {!directoryLoading &&
                                directory.map((emp) => {
                                    const on = selectedId === emp.id;
                                    const total = totals[emp.id] ?? 0;
                                    return (
                                        <button
                                            key={emp.id}
                                            onClick={() => setSelectedId(emp.id)}
                                            title={
                                                emp.active
                                                    ? emp.name
                                                    : `${emp.name} (removed)`
                                            }
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '8px 10px',
                                                marginBottom: 2,
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm, 8px)',
                                                cursor: 'pointer',
                                                background: on
                                                    ? 'var(--surface-alt, #edeffd)'
                                                    : 'transparent',
                                                opacity: emp.active ? 1 : 0.6,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: '50%',
                                                    background:
                                                        COLORS[emp.id % COLORS.length],
                                                    color: '#fff',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    filter: emp.active
                                                        ? 'none'
                                                        : 'grayscale(1)',
                                                }}
                                            >
                                                {initials(emp.name)}
                                            </span>
                                            <span
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    fontSize: 13,
                                                    fontWeight: on ? 700 : 500,
                                                }}
                                            >
                                                {emp.name}
                                                {!emp.active && (
                                                    <span
                                                        style={{
                                                            marginLeft: 6,
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            color: 'var(--text-muted)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 4,
                                                            padding: '0 4px',
                                                        }}
                                                    >
                                                        removed
                                                    </span>
                                                )}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color:
                                                        total > 0
                                                            ? 'var(--text)'
                                                            : 'var(--text-muted)',
                                                    background: 'var(--surface-alt, #f1f5f9)',
                                                    borderRadius: 10,
                                                    padding: '1px 8px',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {total}
                                            </span>
                                        </button>
                                    );
                                })}

                            {!directoryLoading && directory.length === 0 && (
                                <div
                                    style={{
                                        padding: 16,
                                        fontSize: 13,
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    No employees match “{search}”.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* detail */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 24, minWidth: 0 }}>
                        {!selected ? (
                            <div
                                style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    fontSize: 14,
                                }}
                            >
                                Select an employee to see their year.
                            </div>
                        ) : (
                            <>
                                {/* name + year total */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 20,
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 22,
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                            }}
                                        >
                                            {selected.name}
                                            {!selected.active && (
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        color: 'var(--text-muted)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 6,
                                                        padding: '2px 8px',
                                                    }}
                                                >
                                                    removed
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                color: 'var(--text-muted)',
                                                marginTop: 2,
                                            }}
                                        >
                                            {year} attendance record
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
                                            {records.length}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            total lates
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                        Loading…
                                    </div>
                                ) : (
                                    <>
                                        {/* type breakdown */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 12,
                                                marginBottom: 24,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            {LATENESS_TYPES.map((t) => (
                                                <div
                                                    key={t.type}
                                                    style={{
                                                        flex: '1 1 120px',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-sm, 8px)',
                                                        padding: '12px 14px',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            fontSize: 12,
                                                            color: 'var(--text-muted)',
                                                            marginBottom: 4,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 9,
                                                                height: 9,
                                                                borderRadius: '50%',
                                                                background: t.color,
                                                                display: 'inline-block',
                                                            }}
                                                        />
                                                        {t.label}
                                                    </div>
                                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                                        {typeTotals[t.type]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* monthly bars */}
                                        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
                                            By month
                                        </div>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(12, 1fr)',
                                                gap: 4,
                                                alignItems: 'end',
                                                height: 96,
                                                marginBottom: 28,
                                            }}
                                        >
                                            {monthCounts.map((c, i) => (
                                                <div
                                                    key={i}
                                                    title={`${MONTHS[i]}: ${c}`}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-end',
                                                        height: '100%',
                                                        gap: 4,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: c
                                                                ? 'var(--text)'
                                                                : 'var(--text-muted)',
                                                        }}
                                                    >
                                                        {c || ''}
                                                    </span>
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            height: `${(c / maxMonth) * 60}px`,
                                                            minHeight: c ? 4 : 2,
                                                            borderRadius: 4,
                                                            background: c
                                                                ? 'var(--brand, #6366f1)'
                                                                : 'var(--border-light, #e5e7eb)',
                                                        }}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 9,
                                                            color: 'var(--text-muted)',
                                                        }}
                                                    >
                                                        {MONTHS[i]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* dated list */}
                                        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
                                            Every late day
                                        </div>
                                        {byDate.length === 0 ? (
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: 'var(--text-muted)',
                                                    padding: '12px 0',
                                                }}
                                            >
                                                Clean record for {year} — no lates logged. 🎉
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-sm, 8px)',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {byDate.map(([date, types], i) => (
                                                    <div
                                                        key={date}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: 12,
                                                            padding: '10px 14px',
                                                            borderTop:
                                                                i === 0
                                                                    ? 'none'
                                                                    : '1px solid var(--border-light)',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                                                            {fmtDate(date)}
                                                        </span>
                                                        <span
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                flexWrap: 'wrap',
                                                                justifyContent: 'flex-end',
                                                            }}
                                                        >
                                                            {types.map((ty, k) => {
                                                                const meta = typeMeta(ty);
                                                                return (
                                                                    <span
                                                                        key={k}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: 5,
                                                                            fontSize: 12,
                                                                            color: 'var(--text-muted)',
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                width: 8,
                                                                                height: 8,
                                                                                borderRadius: '50%',
                                                                                background: meta.color,
                                                                                display: 'inline-block',
                                                                            }}
                                                                        />
                                                                        {meta.label}
                                                                    </span>
                                                                );
                                                            })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}