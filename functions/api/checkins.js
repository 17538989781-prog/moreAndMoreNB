function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function ensureCheckinsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS checkins_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SLEEP', 'WAKE')),
      check_time TEXT NOT NULL,
      reflection TEXT NOT NULL DEFAULT '',
      happy_thing TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_checkins_v2_user_created ON checkins_v2(user_id, created_at DESC)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_checkins_v2_type_time ON checkins_v2(type, check_time)"
  ).run();
}

async function getAuthUser(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const user = await env.DB.prepare(
    `SELECT u.id, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?
     LIMIT 1`
  ).bind(token, new Date().toISOString()).first();
  return user || null;
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);
    await ensureCheckinsTable(env);

    const result = await env.DB.prepare(
      `SELECT c.id, u.username, c.type, c.check_time, c.reflection, c.happy_thing, c.plan
       FROM checkins_v2 c
       JOIN users u ON u.id = c.user_id
       WHERE c.user_id = ?
       ORDER BY c.check_time DESC`
    ).bind(user.id).all();

    return json({ items: result.results || [] });
  } catch (error) {
    return json({ error: "query checkins failed", detail: String(error && error.message ? error.message : error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);
    await ensureCheckinsTable(env);
    const body = await request.json().catch(() => null);

    if (!body) {
      return json({ error: "invalid json body" }, 400);
    }

    const type = body.type;
    const reflection = body.reflection == null ? "" : String(body.reflection).trim();
    const happyThing = body.happyThing == null ? "" : String(body.happyThing).trim();
    const plan = body.plan == null ? "" : String(body.plan).trim();
    const checkTime = body.checkTime || new Date().toISOString();

    if (type !== "SLEEP" && type !== "WAKE") {
      return json({ error: "type must be SLEEP or WAKE" }, 400);
    }

    const insert = await env.DB.prepare(
      `INSERT INTO checkins_v2 (user_id, type, check_time, reflection, happy_thing, plan)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(user.id, type, checkTime, reflection, happyThing, plan).run();

    return json({ id: insert.meta.last_row_id }, 201);
  } catch (error) {
    return json({ error: "create checkin failed", detail: String(error && error.message ? error.message : error) }, 500);
  }
}
