import {
  CHECKINS_TABLE,
  ensureCheckinsTable,
  formatErrorMessage,
  json,
  USERS_TABLE
} from "./_lib.js";

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const nowIso = new Date().toISOString();
    await ensureCheckinsTable(env);

    const nightOwls = await env.DB.prepare(
      `SELECT u.username, c.check_time, c.reflection, c.happy_thing, c.plan
       FROM ${CHECKINS_TABLE} c
       JOIN ${USERS_TABLE} u ON u.id = c.user_id
       WHERE c.type = 'SLEEP'
         AND julianday(c.check_time) >= julianday(?) - 2
       ORDER BY
         (
           CASE
             WHEN CAST(strftime('%H', c.check_time, 'localtime') AS INTEGER) < 12
               THEN CAST(strftime('%H', c.check_time, 'localtime') AS INTEGER) + 24
             ELSE CAST(strftime('%H', c.check_time, 'localtime') AS INTEGER)
           END
         ) * 60 + CAST(strftime('%M', c.check_time, 'localtime') AS INTEGER) DESC
       LIMIT 20`
    ).bind(nowIso).all();

    const earlyBirds = await env.DB.prepare(
      `SELECT u.username, c.check_time, c.reflection, c.happy_thing, c.plan
       FROM ${CHECKINS_TABLE} c
       JOIN ${USERS_TABLE} u ON u.id = c.user_id
       WHERE c.type = 'WAKE'
         AND julianday(c.check_time) >= julianday(?) - 2
       ORDER BY
         CAST(strftime('%H', c.check_time, 'localtime') AS INTEGER) * 60 +
         CAST(strftime('%M', c.check_time, 'localtime') AS INTEGER) ASC
       LIMIT 20`
    ).bind(nowIso).all();

    return json({
      nightOwls: nightOwls.results || [],
      earlyBirds: earlyBirds.results || [],
      currentTime: nowIso
    });
  } catch (error) {
    return json(formatErrorMessage(error, "load leaderboard failed"), 500);
  }
}
