export interface Employee {
    id: number;
    name: string;
    active: boolean;
}

export interface LatenessRecord {
    employee_id: number;
    date: string; // 'YYYY-MM-DD'
    count: number;
}
