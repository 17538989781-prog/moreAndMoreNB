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
    const reflectionTag = body.reflectionTag == null ? "" : String(body.reflectionTag).trim();
    const happyThing = body.happyThing == null ? "" : String(body.happyThing).trim();
    const happyTag = body.happyTag == null ? "" : String(body.happyTag).trim();
    const plan = body.plan == null ? "" : String(body.plan).trim();
    const planTag = body.planTag == null ? "" : String(body.planTag).trim();

    await env.DB.prepare(
      `UPDATE ${CHECKINS_TABLE}
       SET reflection = ?, reflection_tag = ?, happy_thing = ?, happy_tag = ?, plan = ?, plan_tag = ?
       WHERE id = ? AND user_id = ?`
    ).bind(reflection, reflectionTag, happyThing, happyTag, plan, planTag, id, user.id).run();

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
    const hasReflectionTag = Object.prototype.hasOwnProperty.call(body, "reflectionTag");
    const hasHappyThing = Object.prototype.hasOwnProperty.call(body, "happyThing");
    const hasHappyTag = Object.prototype.hasOwnProperty.call(body, "happyTag");
    const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan");
    const hasPlanTag = Object.prototype.hasOwnProperty.call(body, "planTag");
    if (!hasReflection && !hasReflectionTag && !hasHappyThing && !hasHappyTag && !hasPlan && !hasPlanTag) {
      return json({ error: "at least one of reflection/reflectionTag/happyThing/happyTag/plan/planTag is required" }, 400);
    }

    const current = await env.DB.prepare(
      `SELECT reflection, reflection_tag, happy_thing, happy_tag, plan, plan_tag
       FROM ${CHECKINS_TABLE}
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    ).bind(id, user.id).first();

    if (!current) {
      return json({ error: "checkin not found" }, 404);
    }

    const reflection = hasReflection ? String(body.reflection == null ? "" : body.reflection).trim() : current.reflection;
    const reflectionTag = hasReflectionTag ? String(body.reflectionTag == null ? "" : body.reflectionTag).trim() : current.reflection_tag;
    const happyThing = hasHappyThing ? String(body.happyThing == null ? "" : body.happyThing).trim() : current.happy_thing;
    const happyTag = hasHappyTag ? String(body.happyTag == null ? "" : body.happyTag).trim() : current.happy_tag;
    const plan = hasPlan ? String(body.plan == null ? "" : body.plan).trim() : current.plan;
    const planTag = hasPlanTag ? String(body.planTag == null ? "" : body.planTag).trim() : current.plan_tag;

    await env.DB.prepare(
      `UPDATE ${CHECKINS_TABLE}
       SET reflection = ?, reflection_tag = ?, happy_thing = ?, happy_tag = ?, plan = ?, plan_tag = ?
       WHERE id = ? AND user_id = ?`
    ).bind(reflection, reflectionTag, happyThing, happyTag, plan, planTag, id, user.id).run();

    return json({ ok: true });
  } catch (error) {
    return json(formatErrorMessage(error, "patch checkin failed"), 500);
  }
}
