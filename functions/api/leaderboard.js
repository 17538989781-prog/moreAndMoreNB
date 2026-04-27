import {
  CHECKINS_TABLE,
  ensureCheckinsTable,
  formatErrorMessage,
  json,
  USERS_TABLE
} from "./_lib.js";

function getBeijingDateParts(date = new Date()) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const bj = new Date(utcMs + 8 * 60 * 60 * 1000);
  return {
    year: bj.getUTCFullYear(),
    month: bj.getUTCMonth() + 1,
    day: bj.getUTCDate(),
    hour: bj.getUTCHours()
  };
}

function toIsoFromBeijingLocal(year, month, day, hour) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, 0, 0, 0)).toISOString();
}

function getWindowsByBeijingNow(now = new Date()) {
  const bj = getBeijingDateParts(now);
  const todayStart = new Date(Date.UTC(bj.year, bj.month - 1, bj.day, 0, 0, 0, 0));
  const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const y = { year: yesterday.getUTCFullYear(), month: yesterday.getUTCMonth() + 1, day: yesterday.getUTCDate() };
  const t = { year: todayStart.getUTCFullYear(), month: todayStart.getUTCMonth() + 1, day: todayStart.getUTCDate() };
  const n = { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate() };

  const earlyStart = bj.hour >= 4
    ? toIsoFromBeijingLocal(t.year, t.month, t.day, 4)
    : toIsoFromBeijingLocal(y.year, y.month, y.day, 4);
  const earlyEnd = bj.hour >= 4
    ? toIsoFromBeijingLocal(t.year, t.month, t.day, 18)
    : toIsoFromBeijingLocal(y.year, y.month, y.day, 18);

  let nightStart;
  let nightEnd;
  if (bj.hour < 4) {
    nightStart = toIsoFromBeijingLocal(y.year, y.month, y.day, 18);
    nightEnd = toIsoFromBeijingLocal(t.year, t.month, t.day, 4);
  } else if (bj.hour >= 18) {
    nightStart = toIsoFromBeijingLocal(t.year, t.month, t.day, 18);
    nightEnd = toIsoFromBeijingLocal(n.year, n.month, n.day, 4);
  } else {
    nightStart = toIsoFromBeijingLocal(y.year, y.month, y.day, 18);
    nightEnd = toIsoFromBeijingLocal(t.year, t.month, t.day, 4);
  }

  return { earlyStart, earlyEnd, nightStart, nightEnd };
}

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const nowIso = new Date().toISOString();
    await ensureCheckinsTable(env);
    const { earlyStart, earlyEnd, nightStart, nightEnd } = getWindowsByBeijingNow(new Date());

    const nightOwls = await env.DB.prepare(
      `WITH latest AS (
         SELECT c.*,
                ROW_NUMBER() OVER (PARTITION BY c.user_id, c.type ORDER BY c.check_time DESC, c.id DESC) AS rn
         FROM ${CHECKINS_TABLE} c
         WHERE c.type = 'SLEEP'
           AND c.check_time >= ?
           AND c.check_time < ?
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
    ).bind(nightStart, nightEnd).all();

    const earlyBirds = await env.DB.prepare(
      `WITH latest AS (
         SELECT c.*,
                ROW_NUMBER() OVER (PARTITION BY c.user_id, c.type ORDER BY c.check_time DESC, c.id DESC) AS rn
         FROM ${CHECKINS_TABLE} c
         WHERE c.type = 'WAKE'
           AND c.check_time >= ?
           AND c.check_time < ?
       )
       SELECT u.username, l.check_time, l.reflection, l.happy_thing, l.plan
       FROM latest l
       JOIN ${USERS_TABLE} u ON u.id = l.user_id
       WHERE l.rn = 1
       ORDER BY
         CAST(strftime('%H', l.check_time, 'localtime') AS INTEGER) * 60 +
         CAST(strftime('%M', l.check_time, 'localtime') AS INTEGER) ASC
       LIMIT 20`
    ).bind(earlyStart, earlyEnd).all();

    return json({
      nightOwls: nightOwls.results || [],
      earlyBirds: earlyBirds.results || [],
      currentTime: nowIso
    });
  } catch (error) {
    return json(formatErrorMessage(error, "load leaderboard failed"), 500);
  }
}
