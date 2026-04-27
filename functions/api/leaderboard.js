function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const nowIso = new Date().toISOString();

  const nightOwls = await env.DB.prepare(
    `SELECT u.username, c.check_time, c.reflection, c.happy_thing, c.plan
     FROM checkins c
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
     FROM checkins c
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
}
