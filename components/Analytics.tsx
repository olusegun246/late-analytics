'use client';

import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import type { Employee } from '@/lib/types';
import { COLORS } from '@/lib/colors';

export default function Analytics({
    open,
    employees,
    totals,
}: {
    open: boolean;
    employees: Employee[];
    totals: number[];
}) {
    const barRef = useRef<HTMLCanvasElement>(null);
    const pieRef = useRef<HTMLCanvasElement>(null);
    const barChart = useRef<Chart | null>(null);
    const pieChart = useRef<Chart | null>(null);

    useEffect(() => {
        if (!open) return;

        const labels = employees.map((e) => e.name);
        const colors = employees.map((_, i) => COLORS[i % COLORS.length]);

        // ── bar chart ──
        if (barChart.current) barChart.current.destroy();
        if (barRef.current) {
            barChart.current = new Chart(barRef.current, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Total Lates',
                            data: totals,
                            backgroundColor: totals.map((v, i) =>
                                v === 0 ? 'rgba(209,213,219,0.5)' : colors[i]
                            ),
                            borderRadius: 6,
                            borderSkipped: false,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const v = Number(ctx.raw);
                                    return `${v} late${v !== 1 ? 's' : ''}`;
                                },
                            },
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1, font: { size: 10 } },
                            grid: { color: '#f0f1f5' },
                        },
                        x: {
                            ticks: { font: { size: 9 }, maxRotation: 60, minRotation: 45 },
                            grid: { display: false },
                        },
                    },
                },
            });
        }

        // ── doughnut chart (distribution) ──
        const groups = [0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4+
        totals.forEach((v) => {
            if (v === 0) groups[0]++;
            else if (v === 1) groups[1]++;
            else if (v === 2) groups[2]++;
            else if (v === 3) groups[3]++;
            else groups[4]++;
        });

        if (pieChart.current) pieChart.current.destroy();
        if (pieRef.current) {
            pieChart.current = new Chart(pieRef.current, {
                type: 'doughnut',
                data: {
                    labels: ['Clean (0)', '1 Late', '2 Lates', '3 Lates', '4+ Lates'],
                    datasets: [
                        {
                            data: groups,
                            backgroundColor: [
                                '#d1d5db',
                                '#fcd34d',
                                '#fb923c',
                                '#f87171',
                                '#ef4444',
                            ],
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 16,
                                font: { size: 11 },
                                usePointStyle: true,
                                pointStyleWidth: 8,
                            },
                        },
                    },
                    cutout: '60%',
                },
            });
        }

        return () => {
            barChart.current?.destroy();
            pieChart.current?.destroy();
            barChart.current = null;
            pieChart.current = null;
        };
    }, [open, employees, totals]);

    return (
        <>
            <div className="chart-wrap">
                <canvas ref={barRef} />
            </div>
            <div className="chart-wrap-sm">
                <canvas ref={pieRef} />
            </div>
        </>
    );
}
