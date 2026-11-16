import { pool } from './db.js';
import { migrations } from './schema.js';

export async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, at timestamptz DEFAULT now())');
  const done = new Set((await pool.query('SELECT id FROM _migrations')).rows.map((r) => r.id));
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(m.sql);
      await c.query('INSERT INTO _migrations(id) VALUES ($1)', [m.id]);
      await c.query('COMMIT');
      console.log('migrated', m.id);
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
}

if (process.argv[1]?.match(/migrate\.(ts|js)$/)) {
  migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
