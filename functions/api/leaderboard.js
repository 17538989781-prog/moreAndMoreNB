function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function ensureCheckinsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS checkins_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SLEEP', 'WAKE')),
      check_time TEXT NOT NULL,
      reflection TEXT NOT NULL DEFAULT '',
      happy_thing TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
}

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const nowIso = new Date().toISOString();
    await ensureCheckinsTable(env);

    const nightOwls = await env.DB.prepare(
      `SELECT u.username, c.check_time, c.reflection, c.happy_thing, c.plan
       FROM checkins_v2 c
       JOIN users u ON u.id = c.user_id
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
       FROM checkins_v2 c
       JOIN users u ON u.id = c.user_id
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
    return json({ error: "load leaderboard failed", detail: String(error && error.message ? error.message : error) }, 500);
  }
}
