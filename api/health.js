async function redisCommand(args) {
  const url   = process.env.STORAGE_URL   || process.env.KV_REST_API_URL;
  const token = process.env.STORAGE_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Missing env vars");
  const res = await fetch(`${url}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  let redisStatus = "unknown";
  let buffered    = 0;

  try {
    buffered    = await redisCommand(["LLEN", "donations"]) || 0;
    redisStatus = "connected ✅";
  } catch (err) {
    redisStatus = "error: " + err.message;
  }

  const url   = process.env.STORAGE_URL   || process.env.KV_REST_API_URL   || "";
  const token = process.env.STORAGE_TOKEN || process.env.KV_REST_API_TOKEN || "";

  res.status(200).json({
    status:       "ok",
    service:      "BagiBagi → Roblox Bridge v4 (Upstash Redis)",
    timestamp:    new Date().toISOString(),
    redis_status: redisStatus,
    buffered:     buffered,
    env_check: {
      BAGIBAGI_WEBHOOK_TOKEN: !!process.env.BAGIBAGI_WEBHOOK_TOKEN,
      STORAGE_URL:            !!url,
      STORAGE_TOKEN:          !!token,
    },
  });
};
