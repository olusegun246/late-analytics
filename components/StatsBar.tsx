'use client';

export default function StatsBar({
    employeeCount,
    totalLates,
    workDaysRemaining,
    cleanRecords,
}: {
    employeeCount: number;
    totalLates: number;
    workDaysRemaining: number;
    cleanRecords: number;
}) {
    const cards = [
        { icon: '👥', cls: 'purple', value: employeeCount, label: 'Active Employees' },
        { icon: '⏰', cls: 'red', value: totalLates, label: 'Total Lates This Period' },
        { icon: '📅', cls: 'amber', value: workDaysRemaining, label: 'Work Days Remaining' },
        { icon: '✅', cls: 'green', value: cleanRecords, label: 'Clean Records' },
    ];

    return (
        <div className="stats-bar">
            {cards.map((c) => (
                <div className="stat-card" key={c.label}>
                    <div className={`stat-icon ${c.cls}`}>{c.icon}</div>
                    <div className="stat-info">
                        <div className="stat-value">{c.value}</div>
                        <div className="stat-label">{c.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
