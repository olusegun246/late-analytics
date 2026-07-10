'use client';

import { useState, type MouseEvent } from 'react';
import type { Employee, LatenessType } from '@/lib/types';
import { LATENESS_TYPES } from '@/lib/types';
import { toDateStr, isWeekend } from '@/lib/dates';

interface MenuState {
    x: number;
    y: number;
    empId: number;
    dateStr: string;
    empName: string;
}

// Small colored dots shown inside a cell for the types present that day.
function Dots({ types }: { types: LatenessType[] }) {
    if (types.length === 0) return null;
    return (
        <span style={{ display: 'inline-flex', gap: 3 }}>
            {LATENESS_TYPES.filter((t) => types.includes(t.type)).map((t) => (
                <span
                    key={t.type}
                    style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: t.color,
                        display: 'inline-block',
                    }}
                />
            ))}
        </span>
    );
}

export default function TrackerGrid({
    employees,
    days,
    getTypes,
    empTotal,
    selectedId,
    onToggle,
    onAddNote,
}: {
    employees: Employee[];
    days: Date[];
    getTypes: (empId: number, dateStr: string) => LatenessType[];
    empTotal: (empId: number) => number;
    selectedId: number | null;
    onToggle: (empId: number, dateStr: string, type: LatenessType) => void;
    onAddNote: (
        empId: number,
        dateStr: string,
        type: LatenessType,
        body: string
    ) => Promise<void> | void;
}) {
    const [menu, setMenu] = useState<MenuState | null>(null);

    // Note-box state (lives with the open popup).
    const [noteText, setNoteText] = useState('');
    const [noteType, setNoteType] = useState<LatenessType>('work');
    const [savingNote, setSavingNote] = useState(false);
    const [noteSaved, setNoteSaved] = useState(false);

    const dayTotals = days.map((d) =>
        employees.reduce((sum, e) => sum + getTypes(e.id, toDateStr(d)).length, 0)
    );
    const grandTotal = dayTotals.reduce((a, b) => a + b, 0);

    const openMenu = (
        e: MouseEvent,
        empId: number,
        empName: string,
        dateStr: string
    ) => {
        e.preventDefault();
        // Keep the popup on screen (rough clamp — it's taller now with the note box).
        const x = Math.min(e.clientX, window.innerWidth - 240);
        const y = Math.min(e.clientY, window.innerHeight - 320);

        // Default the note to whatever type is already marked that day.
        const types = getTypes(empId, dateStr);
        setNoteType(types[0] ?? 'work');
        setNoteText('');
        setNoteSaved(false);
        setMenu({ x, y, empId, dateStr, empName });
    };

    const closeMenu = () => setMenu(null);

    const saveNote = async () => {
        if (!menu) return;
        const body = noteText.trim();
        if (!body || savingNote) return;
        setSavingNote(true);
        try {
            await onAddNote(menu.empId, menu.dateStr, noteType, body);
            setNoteText('');
            setNoteSaved(true);
            // Let the little "saved" hint linger, then fade.
            window.setTimeout(() => setNoteSaved(false), 1500);
        } finally {
            setSavingNote(false);
        }
    };

    const menuTypes = menu ? getTypes(menu.empId, menu.dateStr) : [];

    return (
        <>
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
                                    const types = getTypes(emp.id, dateStr);
                                    return (
                                        <td key={dateStr}>
                                            <button
                                                className="tally-cell"
                                                title={`${emp.name} — ${dateStr}: click to mark lateness`}
                                                onClick={(e) =>
                                                    openMenu(e, emp.id, emp.name, dateStr)
                                                }
                                            >
                                                <Dots types={types} />
                                            </button>
                                        </td>
                                    );
                                })}
                                <td style={{ fontWeight: 700, padding: 4 }}>
                                    <span
                                        className="tally-cell"
                                        style={{
                                            cursor: 'default',
                                            fontWeight: 700,
                                            color:
                                                total > 0
                                                    ? 'var(--text)'
                                                    : 'var(--text-muted)',
                                        }}
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

            {/* Type-picker popup */}
            {menu && (
                <>
                    {/* transparent overlay closes the menu on outside click */}
                    <div
                        onClick={closeMenu}
                        style={{ position: 'fixed', inset: 0, zIndex: 300 }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: menu.x,
                            top: menu.y,
                            zIndex: 301,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: 8,
                            width: 220,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                padding: '4px 8px 8px',
                                borderBottom: '1px solid var(--border-light)',
                                marginBottom: 4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {menu.empName} · {menu.dateStr.slice(5)}
                        </div>
                        {LATENESS_TYPES.map((t) => {
                            const on = menuTypes.includes(t.type);
                            return (
                                <div
                                    key={t.type}
                                    onClick={() =>
                                        onToggle(menu.empId, menu.dateStr, t.type)
                                    }
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 8px',
                                        borderRadius: 'var(--radius-xs)',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        background: on ? 'var(--surface-alt)' : 'transparent',
                                    }}
                                >
                                    {/* checkbox */}
                                    <span
                                        style={{
                                            width: 18,
                                            height: 18,
                                            borderRadius: 4,
                                            border: `2px solid ${on ? t.color : 'var(--border)'}`,
                                            background: on ? t.color : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontSize: 12,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {on ? '✓' : ''}
                                    </span>
                                    {/* color dot + label */}
                                    <span
                                        style={{
                                            width: 9,
                                            height: 9,
                                            borderRadius: '50%',
                                            background: t.color,
                                            display: 'inline-block',
                                            flexShrink: 0,
                                        }}
                                    />
                                    {t.label}
                                </div>
                            );
                        })}

                        {/* ── Add a note ── */}
                        <div
                            style={{
                                borderTop: '1px solid var(--border-light)',
                                marginTop: 4,
                                paddingTop: 8,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    padding: '0 8px 6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <span>Add a note</span>
                                {noteSaved && (
                                    <span style={{ color: 'var(--brand)', fontWeight: 600 }}>
                                        ✓ saved
                                    </span>
                                )}
                            </div>

                            <div style={{ padding: '0 8px' }}>
                                <select
                                    value={noteType}
                                    onChange={(e) =>
                                        setNoteType(e.target.value as LatenessType)
                                    }
                                    style={{
                                        width: '100%',
                                        fontSize: 12,
                                        padding: '6px 8px',
                                        borderRadius: 6,
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {LATENESS_TYPES.map((t) => (
                                        <option key={t.type} value={t.type}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>

                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Enter saves; Shift+Enter makes a new line.
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            saveNote();
                                        }
                                    }}
                                    placeholder="e.g. called ahead, traffic on I-45"
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        fontSize: 13,
                                        padding: '7px 9px',
                                        borderRadius: 6,
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        outline: 'none',
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        boxSizing: 'border-box',
                                    }}
                                />

                                <button
                                    onClick={saveNote}
                                    disabled={savingNote || !noteText.trim()}
                                    style={{
                                        width: '100%',
                                        marginTop: 6,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: '7px 0',
                                        borderRadius: 6,
                                        border: 'none',
                                        cursor:
                                            savingNote || !noteText.trim()
                                                ? 'default'
                                                : 'pointer',
                                        color: '#fff',
                                        background: 'var(--brand, #6366f1)',
                                        opacity: savingNote || !noteText.trim() ? 0.5 : 1,
                                    }}
                                >
                                    {savingNote ? 'Saving…' : 'Add note'}
                                </button>
                            </div>
                        </div>

                        <div
                            onClick={closeMenu}
                            style={{
                                textAlign: 'center',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--brand)',
                                padding: '8px 0 4px',
                                cursor: 'pointer',
                                borderTop: '1px solid var(--border-light)',
                                marginTop: 8,
                            }}
                        >
                            Done
                        </div>
                    </div>
                </>
            )}
        </>
    );
}