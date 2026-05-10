import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { log } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const dataDirectory = path.join(backendRoot, "data");
const databasePath = path.join(dataDirectory, "control-plane.db");

if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
}

export const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    tool_pattern TEXT,
    action TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    tool_name TEXT,
    arguments TEXT,
    status TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    type TEXT,
    payload TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const approvalColumns = db.prepare("PRAGMA table_info(approvals)").all() as Array<{
    name: string;
}>;

if (!approvalColumns.some(column => column.name === "expires_at")) {
    db.exec("ALTER TABLE approvals ADD COLUMN expires_at DATETIME");
}

log("BOOT", "sqlite initialized", { databasePath });
