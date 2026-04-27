function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") || "").trim();

  if (!username) {
    return json({ error: "username is required" }, 400);
  }

  const result = await env.DB.prepare(
    `SELECT id, username, type, check_time, reflection, plan
     FROM checkins
     WHERE username = ?
     ORDER BY check_time DESC`
  ).bind(username).all();

  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => null);

  if (!body) {
    return json({ error: "invalid json body" }, 400);
  }

  const username = (body.username || "").trim();
  const type = body.type;
  const reflection = body.reflection == null ? "" : String(body.reflection).trim();
  const plan = body.plan == null ? "" : String(body.plan).trim();
  const checkTime = body.checkTime || new Date().toISOString();

  if (!username) {
    return json({ error: "username is required" }, 400);
  }
  if (type !== "SLEEP" && type !== "WAKE") {
    return json({ error: "type must be SLEEP or WAKE" }, 400);
  }

  const insert = await env.DB.prepare(
    `INSERT INTO checkins (username, type, check_time, reflection, plan)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(username, type, checkTime, reflection, plan).run();

  return json({ id: insert.meta.last_row_id }, 201);
}
