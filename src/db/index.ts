import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema.js'

const dbPath = process.env.DB_PATH ?? 'data/scout.db'
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
	CREATE TABLE IF NOT EXISTS server_configs (
		guild_id     TEXT PRIMARY KEY,
		channel_id   TEXT NOT NULL,
		configured_by TEXT NOT NULL,
		configured_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS tracked_projects (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		guild_id     TEXT NOT NULL,
		project_id   TEXT NOT NULL,
		slug         TEXT NOT NULL,
		name         TEXT NOT NULL,
		last_updated TEXT NOT NULL,
		added_by     TEXT NOT NULL,
		added_at     INTEGER NOT NULL,
		UNIQUE(guild_id, project_id)
	);
`)

export const db = drizzle(sqlite, { schema })
