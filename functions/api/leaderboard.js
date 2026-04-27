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
      `WITH latest AS (
         SELECT c.*,
                ROW_NUMBER() OVER (PARTITION BY c.user_id, c.type ORDER BY c.check_time DESC, c.id DESC) AS rn
         FROM ${CHECKINS_TABLE} c
         WHERE c.type = 'SLEEP'
           AND julianday(c.check_time) >= julianday(?) - 2
       )
       SELECT u.username, l.check_time, l.reflection, l.happy_thing, l.plan
       FROM latest l
       JOIN ${USERS_TABLE} u ON u.id = l.user_id
       WHERE l.rn = 1
       ORDER BY
         (
           CASE
             WHEN CAST(strftime('%H', l.check_time, 'localtime') AS INTEGER) < 12
              THEN CAST(strftime('%H', l.check_time, 'localtime') AS INTEGER) + 24
            ELSE CAST(strftime('%H', l.check_time, 'localtime') AS INTEGER)
           END
         ) * 60 + CAST(strftime('%M', l.check_time, 'localtime') AS INTEGER) DESC
       LIMIT 20`
    ).bind(nowIso).all();

    const earlyBirds = await env.DB.prepare(
      `WITH latest AS (
         SELECT c.*,
                ROW_NUMBER() OVER (PARTITION BY c.user_id, c.type ORDER BY c.check_time DESC, c.id DESC) AS rn
         FROM ${CHECKINS_TABLE} c
         WHERE c.type = 'WAKE'
           AND julianday(c.check_time) >= julianday(?) - 2
       )
       SELECT u.username, l.check_time, l.reflection, l.happy_thing, l.plan
       FROM latest l
       JOIN ${USERS_TABLE} u ON u.id = l.user_id
       WHERE l.rn = 1
       ORDER BY
         CAST(strftime('%H', l.check_time, 'localtime') AS INTEGER) * 60 +
         CAST(strftime('%M', l.check_time, 'localtime') AS INTEGER) ASC
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
