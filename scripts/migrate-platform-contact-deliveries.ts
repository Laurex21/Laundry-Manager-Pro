/** Explicit additive migration; never run unrelated historic migrations at deployment. */
import { readFile } from 'node:fs/promises';
import { pool } from '../server/db';
try {
  await pool.query(await readFile(new URL('../migrations/20261119_platform_contact_deliveries.sql', import.meta.url), 'utf8'));
  console.log('Platform contact delivery tables ready. No business records modified.');
} finally { await pool.end(); }
