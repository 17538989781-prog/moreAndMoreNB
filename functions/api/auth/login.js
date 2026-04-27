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

export async function onRequestPost(context) {
  const { env, request } = context;
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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(token, user.id, expiresAt).run();

  return json({ token, username: user.username });
}
