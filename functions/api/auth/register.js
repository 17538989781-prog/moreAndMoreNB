import {
  ensureAuthTables,
  formatErrorMessage,
  generateToken,
  getSessionExpiresAt,
  json,
  SESSIONS_TABLE,
  sha256,
  USERS_TABLE
} from "../_lib.js";

function randomHex(bytes = 12) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
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
      `SELECT id FROM ${USERS_TABLE} WHERE username = ? LIMIT 1`
    ).bind(username).first();
    if (exists) return json({ error: "username already exists" }, 409);

    const salt = randomHex(12);
    const passwordHash = await sha256(`${salt}:${password}`);
    const userInsert = await env.DB.prepare(
      `INSERT INTO ${USERS_TABLE} (username, password_hash, salt) VALUES (?, ?, ?)`
    ).bind(username, passwordHash, salt).run();
    const userId = userInsert.meta.last_row_id;

    const token = generateToken();
    const expiresAt = getSessionExpiresAt();
    await env.DB.prepare(
      `INSERT INTO ${SESSIONS_TABLE} (token, user_id, expires_at) VALUES (?, ?, ?)`
    ).bind(token, userId, expiresAt).run();

    return json({ token, username }, 201);
  } catch (error) {
    return json(formatErrorMessage(error, "register failed"), 500);
  }
}
