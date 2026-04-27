function json(data, status = 200) {
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

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function generateToken() {
  return `${crypto.randomUUID()}-${randomHex(16)}`;
}

async function ensureAuthTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ).run();
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    await ensureAuthTables(env);
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid json body" }, 400);

    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (username.length < 3) return json({ error: "username must be at least 3 chars" }, 400);
    if (password.length < 6) return json({ error: "password must be at least 6 chars" }, 400);

    const exists = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? LIMIT 1"
    ).bind(username).first();
    if (exists) return json({ error: "username already exists" }, 409);

    const salt = randomHex(12);
    const passwordHash = await sha256(`${salt}:${password}`);
    const userInsert = await env.DB.prepare(
      "INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)"
    ).bind(username, passwordHash, salt).run();
    const userId = userInsert.meta.last_row_id;

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(token, userId, expiresAt).run();

    return json({ token, username }, 201);
  } catch (error) {
    return json({ error: "register failed", detail: String(error && error.message ? error.message : error) }, 500);
  }
}
