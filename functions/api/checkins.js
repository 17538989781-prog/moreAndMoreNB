import {
  CHECKINS_TABLE,
  ensureCheckinsTable,
  formatErrorMessage,
  getAuthUser,
  json,
  USERS_TABLE
} from "./_lib.js";

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);
    await ensureCheckinsTable(env);

    const result = await env.DB.prepare(
      `SELECT c.id, u.username, c.type, c.check_time, c.reflection, c.reflection_tag, c.happy_thing, c.happy_tag, c.plan, c.plan_tag
       FROM ${CHECKINS_TABLE} c
       JOIN ${USERS_TABLE} u ON u.id = c.user_id
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
    const reflectionTag = body.reflectionTag == null ? "" : String(body.reflectionTag).trim();
    const happyThing = body.happyThing == null ? "" : String(body.happyThing).trim();
    const happyTag = body.happyTag == null ? "" : String(body.happyTag).trim();
    const plan = body.plan == null ? "" : String(body.plan).trim();
    const planTag = body.planTag == null ? "" : String(body.planTag).trim();
    const checkTime = body.checkTime || new Date().toISOString();

    if (type !== "SLEEP" && type !== "WAKE") {
      return json({ error: "type must be SLEEP or WAKE" }, 400);
    }

    const insert = await env.DB.prepare(
      `INSERT INTO ${CHECKINS_TABLE} (user_id, type, check_time, reflection, reflection_tag, happy_thing, happy_tag, plan, plan_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.id, type, checkTime, reflection, reflectionTag, happyThing, happyTag, plan, planTag).run();

    return json({ id: insert.meta.last_row_id }, 201);
  } catch (error) {
    return json(formatErrorMessage(error, "create checkin failed"), 500);
  }
}
