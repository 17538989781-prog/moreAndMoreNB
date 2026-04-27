import {
  ensureAuthTables,
  formatErrorMessage,
  generateToken,
  getSessionExpiresAt,
  json,
  sha256
} from "../_lib.js";

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    await ensureAuthTables(env);
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid json body" }, 400);

    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) return json({ error: "username and password are required" }, 400);

    const user = await env.DB.prepare(
      "SELECT id, username, password_hash, salt FROM users WHERE username = ? LIMIT 1"
    ).bind(username).first();
    if (!user) return json({ error: "invalid credentials" }, 401);

    const expected = await sha256(`${user.salt}:${password}`);
    if (expected !== user.password_hash) return json({ error: "invalid credentials" }, 401);

    const token = generateToken();
    const expiresAt = getSessionExpiresAt();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(token, user.id, expiresAt).run();

    return json({ token, username: user.username });
  } catch (error) {
    return json(formatErrorMessage(error, "login failed"), 500);
  }
}
