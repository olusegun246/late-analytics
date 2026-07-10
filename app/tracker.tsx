'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Employee, LatenessRecord } from '@/lib/types';
import {
    getPeriodDays,
    getPeriodLabel,
    getWorkDaysRemaining,
    toDateStr,
    addDays,
} from '@/lib/dates';
import {
    getLatenessForRange,
    setTally as setTallyAction,
    addEmployee as addEmployeeAction,
    updateEmployee as updateEmployeeAction,
    deleteEmployee as deleteEmployeeAction,
    resetPeriod as resetPeriodAction,
} from './actions';

import Sidebar from '@/components/Sidebar';
import StatsBar from '@/components/StatsBar';
import TrackerGrid from '@/components/TrackerGrid';
import Analytics from '@/components/Analytics';
import EmployeeModal from '@/components/EmployeeModal';

// Record map key: "employeeId|YYYY-MM-DD"
const rk = (empId: number, dateStr: string) => `${empId}|${dateStr}`;

function recordsToMap(records: LatenessRecord[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of records) map[rk(r.employee_id, r.date)] = r.count;
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
    const [records, setRecords] = useState<Record<string, number>>(
        recordsToMap(initialRecords)
    );
    const [periodStartMs, setPeriodStartMs] = useState<number>(initialPeriodStartMs);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
    const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

    const periodStart = useMemo(() => new Date(periodStartMs), [periodStartMs]);
    const days = useMemo(() => getPeriodDays(periodStart), [periodStart]);

    // ── derived values ──────────────────────────
    const getCount = useCallback(
        (empId: number, dateStr: string) => records[rk(empId, dateStr)] ?? 0,
        [records]
    );

    const empTotal = useCallback(
        (empId: number) =>
            days.reduce((sum, d) => sum + getCount(empId, toDateStr(d)), 0),
        [days, getCount]
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

    // ── cell click (optimistic, then persist) ───
    const handleCell = useCallback(
        async (empId: number, dateStr: string, delta: number) => {
            const current = records[rk(empId, dateStr)] ?? 0;
            const next = Math.max(0, current + delta);
            if (next === current) return;

            setRecords((prev) => {
                const copy = { ...prev };
                if (next <= 0) delete copy[rk(empId, dateStr)];
                else copy[rk(empId, dateStr)] = next;
                return copy;
            });

            try {
                await setTallyAction(empId, dateStr, next);
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

    const handleReset = useCallback(async () => {
        if (
            !window.confirm(
                `Reset ALL lateness data for ${getPeriodLabel(
                    periodStart
                )}? This cannot be undone.`
            )
        )
            return;
        await resetPeriodAction(toDateStr(days[0]), toDateStr(days[13]));
        setRecords({});
        showToast('🔄 Period reset');
    }, [periodStart, days, showToast]);

    // ── employee add / edit / remove ────────────
    const openAdd = useCallback(
        () => setModal({ open: true, mode: 'add' }),
        []
    );
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

    // ── CSV export ──────────────────────────────
    const exportCSV = useCallback(() => {
        let csv = 'Employee,' + days.map((d) => toDateStr(d)).join(',') + ',Total\n';
        for (const e of employees) {
            const cells = days.map((d) => getCount(e.id, toDateStr(d)));
            const total = cells.reduce((a, b) => a + b, 0);
            csv += `"${e.name}",${cells.join(',')},${total}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lateness-${toDateStr(days[0])}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📥 CSV exported');
    }, [days, employees, getCount, showToast]);

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
                        <button className="btn btn-ghost" onClick={exportCSV}>
                            📥 Export CSV
                        </button>
                        <button className="btn btn-ghost" onClick={handleReset}>
                            🔄 Reset Period
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
                            <h3>📅 Pay Period Grid — Click cells to tally lates</h3>
                            <span
                                style={{ fontSize: 11, color: 'var(--text-muted)' }}
                            >
                                Right-click to decrement
                            </span>
                        </div>
                        <div className="panel-body">
                            <TrackerGrid
                                employees={employees}
                                days={days}
                                getCount={getCount}
                                empTotal={empTotal}
                                selectedId={selectedId}
                                onCell={handleCell}
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

            {toast && (
                <div className={`toast ${toast.type} show`}>{toast.msg}</div>
            )}
        </>
    );
}
