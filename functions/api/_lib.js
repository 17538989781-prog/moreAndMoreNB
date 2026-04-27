export const CHECKINS_TABLE = "checkins_v2";
export const USERS_TABLE = "users_v2";
export const SESSIONS_TABLE = "sessions_v2";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export function generateToken() {
  return `${crypto.randomUUID()}-${randomHex(16)}`;
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export async function ensureAuthTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ${SESSIONS_TABLE} (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES ${USERS_TABLE}(id)
    )`
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_${SESSIONS_TABLE}_user
     ON ${SESSIONS_TABLE}(user_id, expires_at DESC)`
  ).run();
}

export async function ensureCheckinsTable(env) {
  await ensureAuthTables(env);

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ${CHECKINS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SLEEP', 'WAKE')),
      check_time TEXT NOT NULL,
      reflection TEXT NOT NULL DEFAULT '',
      reflection_tag TEXT NOT NULL DEFAULT '',
      happy_thing TEXT NOT NULL DEFAULT '',
      happy_tag TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      plan_tag TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES ${USERS_TABLE}(id)
    )`
  ).run();

  const tableInfo = await env.DB.prepare(`PRAGMA table_info(${CHECKINS_TABLE})`).all();
  const columns = new Set((tableInfo.results || []).map((col) => String(col.name)));
  if (!columns.has("reflection_tag")) {
    await env.DB.prepare(`ALTER TABLE ${CHECKINS_TABLE} ADD COLUMN reflection_tag TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!columns.has("happy_tag")) {
    await env.DB.prepare(`ALTER TABLE ${CHECKINS_TABLE} ADD COLUMN happy_tag TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!columns.has("plan_tag")) {
    await env.DB.prepare(`ALTER TABLE ${CHECKINS_TABLE} ADD COLUMN plan_tag TEXT NOT NULL DEFAULT ''`).run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_${CHECKINS_TABLE}_user_created
     ON ${CHECKINS_TABLE}(user_id, created_at DESC)`
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_${CHECKINS_TABLE}_type_time
     ON ${CHECKINS_TABLE}(type, check_time)`
  ).run();
}

export async function getAuthUser(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const user = await env.DB.prepare(
    `SELECT u.id, u.username
     FROM ${SESSIONS_TABLE} s
     JOIN ${USERS_TABLE} u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?
     LIMIT 1`
  ).bind(token, new Date().toISOString()).first();

  return user || null;
}

export function formatErrorMessage(error, fallback) {
  const detail = String(error && error.message ? error.message : error);
  return { error: fallback, detail };
}
