function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
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

    const result = await env.DB.prepare(
      `SELECT c.id, u.username, c.type, c.check_time, c.reflection, c.happy_thing, c.plan
       FROM checkins c
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
      `INSERT INTO checkins (user_id, type, check_time, reflection, happy_thing, plan)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(user.id, type, checkTime, reflection, happyThing, plan).run();

    return json({ id: insert.meta.last_row_id }, 201);
  } catch (error) {
    return json({ error: "create checkin failed", detail: String(error && error.message ? error.message : error) }, 500);
  }
}
