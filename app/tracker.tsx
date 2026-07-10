'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Employee, LatenessRecord, LatenessType } from '@/lib/types';
import { LATENESS_TYPES } from '@/lib/types';
import {
    getPeriodDays,
    getPeriodLabel,
    getWorkDaysRemaining,
    toDateStr,
    addDays,
} from '@/lib/dates';
import {
    getLatenessForRange,
    toggleLate as toggleLateAction,
    addEmployee as addEmployeeAction,
    updateEmployee as updateEmployeeAction,
    deleteEmployee as deleteEmployeeAction,
    getAllEmployees,
    getEmployeeYear,
    getYearTotals,
} from './actions';

import Sidebar from '@/components/Sidebar';
import StatsBar from '@/components/StatsBar';
import TrackerGrid from '@/components/TrackerGrid';
import Analytics from '@/components/Analytics';
import EmployeeModal from '@/components/EmployeeModal';
import EmployeeRecords from '@/components/EmployeeRecords';

// Record map key: "employeeId|YYYY-MM-DD" -> list of lateness types that day
const rk = (empId: number, dateStr: string) => `${empId}|${dateStr}`;

function recordsToMap(
    records: LatenessRecord[]
): Record<string, LatenessType[]> {
    const map: Record<string, LatenessType[]> = {};
    for (const r of records) {
        const key = rk(r.employee_id, r.date);
        (map[key] ??= []).push(r.type);
    }
    return map;
}

interface ModalState {
    open: boolean;
    mode: 'add' | 'edit';
    employee?: Employee;
}

export default function Tracker({
    initialEmployees,
    initialRecords,
    initialPeriodStartMs,
}: {
    initialEmployees: Employee[];
    initialRecords: LatenessRecord[];
    initialPeriodStartMs: number;
}) {
    const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
    const [records, setRecords] = useState<Record<string, LatenessType[]>>(
        recordsToMap(initialRecords)
    );
    const [periodStartMs, setPeriodStartMs] = useState<number>(initialPeriodStartMs);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
    const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

    // ── employee records modal (full-year, incl. removed) ──
    const [recordsOpen, setRecordsOpen] = useState(false);
    const [allEmployees, setAllEmployees] = useState<Employee[] | null>(null);
    const [recordsInitialId, setRecordsInitialId] = useState<number | null>(null);

    const periodStart = useMemo(() => new Date(periodStartMs), [periodStartMs]);
    const days = useMemo(() => getPeriodDays(periodStart), [periodStart]);

    // ── derived values ──────────────────────────
    const getTypes = useCallback(
        (empId: number, dateStr: string): LatenessType[] =>
            records[rk(empId, dateStr)] ?? [],
        [records]
    );

    // "Total lates" = total number of infractions (each type counts as one).
    const empTotal = useCallback(
        (empId: number) =>
            days.reduce((sum, d) => sum + getTypes(empId, toDateStr(d)).length, 0),
        [days, getTypes]
    );

    const periodTotal = useMemo(
        () => employees.reduce((sum, e) => sum + empTotal(e.id), 0),
        [employees, empTotal]
    );

    const cleanRecords = useMemo(
        () => employees.filter((e) => empTotal(e.id) === 0).length,
        [employees, empTotal]
    );

    // ── toast helper ────────────────────────────
    const showToast = useCallback((msg: string, type = '') => {
        setToast({ msg, type });
        window.setTimeout(() => setToast(null), 1800);
    }, []);

    // ── load records for a period ───────────────
    const loadPeriod = useCallback(async (start: Date) => {
        const d = getPeriodDays(start);
        const recs = await getLatenessForRange(toDateStr(d[0]), toDateStr(d[13]));
        setRecords(recordsToMap(recs));
    }, []);

    // ── open the full-year records modal ────────
    // Re-fetches every time so the directory stays correct after adds/removes.
    const openRecords = useCallback(async (empId: number | null = null) => {
        setRecordsInitialId(empId);
        setAllEmployees(null);
        setRecordsOpen(true);
        setAllEmployees(await getAllEmployees());
    }, []);

    // ── toggle one type on a day (optimistic, then persist) ──
    const handleToggle = useCallback(
        async (empId: number, dateStr: string, type: LatenessType) => {
            const key = rk(empId, dateStr);
            const current = records[key] ?? [];
            const on = !current.includes(type); // clicking flips it

            setRecords((prev) => {
                const copy = { ...prev };
                const set = new Set(copy[key] ?? []);
                if (on) set.add(type);
                else set.delete(type);
                const next = [...set];
                if (next.length === 0) delete copy[key];
                else copy[key] = next;
                return copy;
            });

            try {
                await toggleLateAction(empId, dateStr, type, on);
            } catch {
                showToast('⚠️ Could not save — reloading', 'warning');
                await loadPeriod(periodStart); // resync on failure
            }
        },
        [records, periodStart, loadPeriod, showToast]
    );

    // ── period navigation ───────────────────────
    const navigate = useCallback(
        async (dir: number) => {
            const newStart = addDays(periodStart, dir * 14);
            setPeriodStartMs(newStart.getTime());
            await loadPeriod(newStart);
        },
        [periodStart, loadPeriod]
    );

    const goToday = useCallback(async () => {
        const { getCurrentPeriodStart } = await import('@/lib/dates');
        const start = getCurrentPeriodStart();
        setPeriodStartMs(start.getTime());
        await loadPeriod(start);
    }, [loadPeriod]);

    // ── employee add / edit / remove ────────────
    const openAdd = useCallback(() => setModal({ open: true, mode: 'add' }), []);
    const openEdit = useCallback(
        (emp: Employee) => setModal({ open: true, mode: 'edit', employee: emp }),
        []
    );
    const closeModal = useCallback(
        () => setModal({ open: false, mode: 'add' }),
        []
    );

    const confirmModal = useCallback(
        async (name: string) => {
            const trimmed = name.trim();
            if (!trimmed) {
                showToast('Please enter a name', 'warning');
                return;
            }
            if (modal.mode === 'edit' && modal.employee) {
                const emp = modal.employee;
                setEmployees((prev) =>
                    prev.map((e) => (e.id === emp.id ? { ...e, name: trimmed } : e))
                );
                await updateEmployeeAction(emp.id, trimmed);
                showToast('✅ Employee updated');
            } else {
                if (employees.some((e) => e.name === trimmed)) {
                    showToast('Employee already exists', 'warning');
                    return;
                }
                const created = await addEmployeeAction(trimmed);
                setEmployees((prev) =>
                    [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
                );
                showToast(`✅ ${trimmed} added`);
            }
            closeModal();
        },
        [modal, employees, showToast, closeModal]
    );

    const removeEmployee = useCallback(async () => {
        if (modal.mode !== 'edit' || !modal.employee) return;
        const emp = modal.employee;
        if (
            !window.confirm(
                `Remove "${emp.name}"? Their past records are kept but they'll no longer appear.`
            )
        )
            return;
        setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
        if (selectedId === emp.id) setSelectedId(null);
        await deleteEmployeeAction(emp.id);
        closeModal();
        showToast(`🗑️ ${emp.name} removed`);
    }, [modal, selectedId, closeModal, showToast]);

    // ── CSV export (letters per day: W / L / B) ──
    const exportCSV = useCallback(() => {
        const letterOf = (t: LatenessType) =>
            LATENESS_TYPES.find((x) => x.type === t)?.letter ?? '?';

        let csv =
            'Employee,' + days.map((d) => toDateStr(d)).join(',') + ',Total\n';
        for (const e of employees) {
            let total = 0;
            const cells = days.map((d) => {
                const types = getTypes(e.id, toDateStr(d));
                total += types.length;
                return types.map(letterOf).join('+');
            });
            csv += `"${e.name}",${cells.map((c) => `"${c}"`).join(',')},${total}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lateness-${toDateStr(days[0])}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📥 CSV exported');
    }, [days, employees, getTypes, showToast]);

    // ── render ──────────────────────────────────
    return (
        <>
            <Sidebar
                employees={employees}
                empTotal={empTotal}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
                onEdit={openEdit}
                onAdd={openAdd}
            />

            <div className="main">
                <header className="header">
                    <div className="header-left">
                        <h1>📋 Lateness Tracking</h1>
                        <div className="period-nav">
                            <button onClick={() => navigate(-1)} title="Previous Pay Period">
                                ◀
                            </button>
                            <span className="period-label">
                                {getPeriodLabel(periodStart)}
                            </span>
                            <button onClick={() => navigate(1)} title="Next Pay Period">
                                ▶
                            </button>
                            <button
                                onClick={goToday}
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    width: 'auto',
                                    borderRadius: 14,
                                    padding: '0 14px',
                                }}
                                title="Jump to Current Period"
                            >
                                Today
                            </button>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            className={`btn ${analyticsOpen ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setAnalyticsOpen((o) => !o)}
                        >
                            📊 Analytics
                        </button>
                        <button className="btn btn-ghost" onClick={() => openRecords()}>
                            👥 Records
                        </button>
                        <button className="btn btn-ghost" onClick={exportCSV}>
                            📥 Export CSV
                        </button>
                    </div>
                </header>

                <StatsBar
                    employeeCount={employees.length}
                    totalLates={periodTotal}
                    workDaysRemaining={getWorkDaysRemaining(periodStart)}
                    cleanRecords={cleanRecords}
                />

                <div className="content">
                    <div className="panel" style={{ flex: 1 }}>
                        <div className="panel-header">
                            <h3>📅 Pay Period Grid — Click a day to mark lateness</h3>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {LATENESS_TYPES.map((t) => (
                                    <span
                                        key={t.type}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            marginLeft: 12,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: t.color,
                                                display: 'inline-block',
                                            }}
                                        />
                                        {t.label}
                                    </span>
                                ))}
                            </span>
                        </div>
                        <div className="panel-body">
                            <TrackerGrid
                                employees={employees}
                                days={days}
                                getTypes={getTypes}
                                empTotal={empTotal}
                                selectedId={selectedId}
                                onToggle={handleToggle}
                            />
                        </div>
                    </div>

                    <div className={`analytics-panel ${analyticsOpen ? 'open' : ''}`}>
                        <div className="analytics-inner">
                            <Analytics
                                open={analyticsOpen}
                                employees={employees}
                                totals={employees.map((e) => empTotal(e.id))}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {modal.open && (
                <EmployeeModal
                    mode={modal.mode}
                    initialName={modal.employee?.name ?? ''}
                    onConfirm={confirmModal}
                    onRemove={removeEmployee}
                    onClose={closeModal}
                />
            )}

            {recordsOpen && (
                <EmployeeRecords
                    employees={allEmployees ?? []}
                    initialEmployeeId={recordsInitialId}
                    directoryLoading={allEmployees === null}
                    loadYear={getEmployeeYear}
                    loadYearTotals={getYearTotals}
                    onClose={() => setRecordsOpen(false)}
                />
            )}

            {toast && <div className={`toast ${toast.type} show`}>{toast.msg}</div>}
        </>
    );
}