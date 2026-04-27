function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  const nightOwls = await env.DB.prepare(
    `SELECT username, check_time, reflection, plan
     FROM checkins
     WHERE type = 'SLEEP'
     ORDER BY
       (
         CASE
           WHEN CAST(strftime('%H', check_time, 'localtime') AS INTEGER) < 12
             THEN CAST(strftime('%H', check_time, 'localtime') AS INTEGER) + 24
           ELSE CAST(strftime('%H', check_time, 'localtime') AS INTEGER)
         END
       ) * 60 + CAST(strftime('%M', check_time, 'localtime') AS INTEGER) DESC
     LIMIT 20`
  ).all();

  const earlyBirds = await env.DB.prepare(
    `SELECT username, check_time, reflection, plan
     FROM checkins
     WHERE type = 'WAKE'
     ORDER BY
       CAST(strftime('%H', check_time, 'localtime') AS INTEGER) * 60 +
       CAST(strftime('%M', check_time, 'localtime') AS INTEGER) ASC
     LIMIT 20`
  ).all();

  return json({
    nightOwls: nightOwls.results || [],
    earlyBirds: earlyBirds.results || []
  });
}
