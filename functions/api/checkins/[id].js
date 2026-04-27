function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "invalid id" }, 400);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return json({ error: "invalid json body" }, 400);
  }

  const reflection = body.reflection == null ? "" : String(body.reflection).trim();
  const plan = body.plan == null ? "" : String(body.plan).trim();

  await env.DB.prepare(
    `UPDATE checkins
     SET reflection = ?, plan = ?
     WHERE id = ?`
  ).bind(reflection, plan, id).run();

  return json({ ok: true });
}
