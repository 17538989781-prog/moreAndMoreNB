import {
  COMMENTS_TABLE,
  ensureCommentsTable,
  formatErrorMessage,
  getAuthUser,
  json,
  USERS_TABLE
} from "./_lib.js";

export async function onRequestGet(context) {
  try {
    const { env } = context;
    await ensureCommentsTable(env);
    const rows = await env.DB.prepare(
      `SELECT c.id, c.content, c.created_at, u.username
       FROM ${COMMENTS_TABLE} c
       JOIN ${USERS_TABLE} u ON u.id = c.user_id
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 200`
    ).all();
    return json({ items: rows.results || [] });
  } catch (error) {
    return json(formatErrorMessage(error, "load comments failed"), 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    const user = await getAuthUser(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);
    await ensureCommentsTable(env);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid json body" }, 400);

    const content = String(body.content || "").trim();
    if (!content) return json({ error: "content is required" }, 400);
    if (content.length > 300) return json({ error: "content must be <= 300 chars" }, 400);

    const result = await env.DB.prepare(
      `INSERT INTO ${COMMENTS_TABLE} (user_id, content) VALUES (?, ?)`
    ).bind(user.id, content).run();

    return json({ id: result.meta.last_row_id }, 201);
  } catch (error) {
    return json(formatErrorMessage(error, "create comment failed"), 500);
  }
}
