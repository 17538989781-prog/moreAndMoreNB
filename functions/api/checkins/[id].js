import {
  CHECKINS_TABLE,
  ensureCheckinsTable,
  formatErrorMessage,
  getAuthUser,
  json
} from "../_lib.js";

export async function onRequestPut(context) {
  try {
    const { params, request, env } = context;
    const user = await getAuthUser(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);
    await ensureCheckinsTable(env);
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
      `UPDATE ${CHECKINS_TABLE}
       SET reflection = ?, happy_thing = ?, plan = ?
       WHERE id = ? AND user_id = ?`
    ).bind(reflection, happyThing, plan, id, user.id).run();

    return json({ ok: true });
  } catch (error) {
    return json(formatErrorMessage(error, "update checkin failed"), 500);
  }
}
