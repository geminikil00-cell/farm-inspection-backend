import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(
    resolve(__dirname, '../../migrations/001_initial.sql'),
    'utf-8'
  );

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration 001_initial.sql executed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
