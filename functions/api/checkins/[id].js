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

export async function onRequestPatch(context) {
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
    if (!body || typeof body !== "object") {
      return json({ error: "invalid json body" }, 400);
    }

    const hasReflection = Object.prototype.hasOwnProperty.call(body, "reflection");
    const hasHappyThing = Object.prototype.hasOwnProperty.call(body, "happyThing");
    const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan");
    if (!hasReflection && !hasHappyThing && !hasPlan) {
      return json({ error: "at least one of reflection, happyThing, plan is required" }, 400);
    }

    const current = await env.DB.prepare(
      `SELECT reflection, happy_thing, plan
       FROM ${CHECKINS_TABLE}
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    ).bind(id, user.id).first();

    if (!current) {
      return json({ error: "checkin not found" }, 404);
    }

    const reflection = hasReflection ? String(body.reflection == null ? "" : body.reflection).trim() : current.reflection;
    const happyThing = hasHappyThing ? String(body.happyThing == null ? "" : body.happyThing).trim() : current.happy_thing;
    const plan = hasPlan ? String(body.plan == null ? "" : body.plan).trim() : current.plan;

    await env.DB.prepare(
      `UPDATE ${CHECKINS_TABLE}
       SET reflection = ?, happy_thing = ?, plan = ?
       WHERE id = ? AND user_id = ?`
    ).bind(reflection, happyThing, plan, id, user.id).run();

    return json({ ok: true });
  } catch (error) {
    return json(formatErrorMessage(error, "patch checkin failed"), 500);
  }
}
