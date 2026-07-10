import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
    throw new Error(
        'DATABASE_URL is not set. Add it to .env.local (see .env.local.example).'
    );
}

// `sql` is a tagged-template function:  await sql`SELECT * FROM employees`
export const sql = neon(process.env.DATABASE_URL);
