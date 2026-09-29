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
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const TOKEN  = process.env.BAGIBAGI_WEBHOOK_TOKEN || "";
  const secret = req.query.secret || req.headers["x-secret"] || "";
  if (TOKEN && secret !== TOKEN) {
    return res.status(401).json({ error: "Unauthorized — tambahkan ?secret=TOKEN_mu" });
  }

  if (req.method === "GET") {
    let buffered = 0;
    try { buffered = await redisCommand(["LLEN", "donations"]) || 0; } catch {}
    return res.status(200).json({
      info:     "POST ke sini untuk inject donasi test",
      buffered: buffered,
      example:  { name: "TestBudi", amount: 50000, message: "Halo!" },
    });
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const donation = {
    id:        "test_" + Date.now(),
    name:      String(body.name    || "TestUser"),
    amount:    Number(body.amount  || 10000),
    message:   String(body.message || "Test donation"),
    timestamp: Math.floor(Date.now() / 1000),
  };

  try {
    await redisCommand(["LPUSH", "donations", JSON.stringify(donation)]);
    await redisCommand(["LTRIM", "donations", "0", "499"]);
    console.log(`[Test] Injected: ${donation.name} Rp${donation.amount} → Redis`);
    return res.status(200).json({ ok: true, donation });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
