// Server component: runs on the server, fetches the initial data
// straight from Neon, then hands it to the interactive client Tracker.

import { getEmployees, getLatenessForRange } from './actions';
import { getCurrentPeriodStart, getPeriodDays, toDateStr } from '@/lib/dates';
import Tracker from './tracker';

export const dynamic = 'force-dynamic'; // always show fresh data

export default async function Page() {
    const periodStart = getCurrentPeriodStart();
    const days = getPeriodDays(periodStart);

    const [employees, records] = await Promise.all([
        getEmployees(),
        getLatenessForRange(toDateStr(days[0]), toDateStr(days[13])),
    ]);

    return (
        <Tracker
            initialEmployees={employees}
            initialRecords={records}
            initialPeriodStartMs={periodStart.getTime()}
        />
    );
}
