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

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const user = await getAuthUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "invalid id" }, 400);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ error: "invalid json body" }, 400);
  }

  const reflection = body.reflection == null ? "" : String(body.reflection).trim();
  const happyThing = body.happyThing == null ? "" : String(body.happyThing).trim();
  const plan = body.plan == null ? "" : String(body.plan).trim();

  await env.DB.prepare(
    `UPDATE checkins
     SET reflection = ?, happy_thing = ?, plan = ?
     WHERE id = ? AND user_id = ?`
  ).bind(reflection, happyThing, plan, id, user.id).run();

  return json({ ok: true });
}
