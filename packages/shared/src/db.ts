/**
 * SQLite database initialization and access.
 *
 * Uses better-sqlite3 for synchronous, fast access.
 * The database file lives at the project root: data/scout.db
 */

import Database from "better-sqlite3";
import { resolve } from "path";

const DB_PATH = process.env.SCOUT_DB_PATH || resolve(process.cwd(), "data/scout.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      registry TEXT NOT NULL,
      contract_name TEXT,
      source TEXT,
      confidence REAL DEFAULT 0.0,
      status TEXT DEFAULT 'pending',
      agent_reasoning TEXT,
      discovered_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      candidate_id TEXT REFERENCES candidates(id),
      registry TEXT NOT NULL,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      tag TEXT,
      ipfs_cid TEXT,
      tx_hash TEXT,
      item_id TEXT,
      deposit_wei TEXT,
      status TEXT DEFAULT 'submitted',
      payload_json TEXT,
      submitted_at TEXT NOT NULL,
      accepted_at TEXT,
      reward_pnk TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      node TEXT,
      action TEXT,
      input_summary TEXT,
      output_summary TEXT,
      tokens_used INTEGER
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT,
      registry TEXT,
      total_submissions INTEGER DEFAULT 0,
      accepted INTEGER DEFAULT 0,
      challenged INTEGER DEFAULT 0,
      pnk_earned TEXT DEFAULT '0',
      calculated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
    CREATE INDEX IF NOT EXISTS idx_candidates_chain ON candidates(chain);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submissions_registry ON submissions(registry);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
  `);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
