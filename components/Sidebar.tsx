'use client';

import type { Employee } from '@/lib/types';
import { COLORS } from '@/lib/colors';

function initials(name: string) {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export default function Sidebar({
    employees,
    empTotal,
    selectedId,
    onSelect,
    onEdit,
    onAdd,
}: {
    employees: Employee[];
    empTotal: (id: number) => number;
    selectedId: number | null;
    onSelect: (id: number) => void;
    onEdit: (emp: Employee) => void;
    onAdd: () => void;
}) {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">⏰</div>
                <div>
                    <div className="logo-text">LateTrack</div>
                    <div className="logo-sub">Attendance System</div>
                </div>
            </div>

            <div className="sidebar-nav">
                <div className="sidebar-section-title">Employees</div>
                <div>
                    {employees.map((emp, idx) => {
                        const total = empTotal(emp.id);
                        return (
                            <div
                                key={emp.id}
                                className={`sidebar-employee${
                                    selectedId === emp.id ? ' active' : ''
                                }`}
                                onClick={() => onSelect(emp.id)}
                                title="Click to highlight"
                            >
                                <div
                                    className="avatar"
                                    style={{ background: COLORS[idx % COLORS.length] }}
                                >
                                    {initials(emp.name)}
                                </div>
                                <span className="name">{emp.name}</span>
                                <span className={`badge${total === 0 ? ' zero' : ''}`}>
                                    {total}
                                </span>
                                {/* Pencil: opens the edit / remove popup */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // don't also select the row
                                        onEdit(emp);
                                    }}
                                    title="Edit or remove"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#9ca3af',
                                        fontSize: 14,
                                        padding: '2px 4px',
                                        lineHeight: 1,
                                        flexShrink: 0,
                                        borderRadius: 4,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = '#fff';
                                        e.currentTarget.style.background =
                                            'rgba(255,255,255,0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = '#9ca3af';
                                        e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    ✎
                                </button>
                            </div>
                        );
                    })}
                </div>
                <div className="sidebar-add" onClick={onAdd}>
                    + Add Employee
                </div>
            </div>

            <div className="sidebar-footer">
                <span className="dot" />
                <span>
                    {employees.length} employee{employees.length !== 1 ? 's' : ''}
                </span>
            </div>
        </aside>
    );
}