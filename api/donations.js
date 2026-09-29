async function redisCommand(args) {
  const url   = process.env.STORAGE_URL   || process.env.KV_REST_API_URL;
  const token = process.env.STORAGE_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Missing STORAGE_URL or STORAGE_TOKEN");
  }

  const res = await fetch(`${url}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const since = parseInt(req.query.since || "0", 10);

  try {
    const raw = await redisCommand(["LRANGE", "donations", "0", "499"]);

    if (!raw || raw.length === 0) {
      console.log(`[Donations] Redis kosong`);
      return res.status(200).json({
        donations:  [],
        total:      0,
        fetched_at: Math.floor(Date.now() / 1000),
      });
    }

    const allDonations = raw.map(item => {
      if (typeof item === "string") {
        try { return JSON.parse(item); } catch { return null; }
      }
      return item;
    }).filter(Boolean);

    const newDonations = allDonations.filter(d => d.timestamp > since);

    newDonations.sort((a, b) => a.timestamp - b.timestamp);

    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const fresh = allDonations.filter(d => d.timestamp >= oneHourAgo);
    if (fresh.length < allDonations.length) {
      await redisCommand(["DEL", "donations"]);
      for (const d of fresh.reverse()) {
        await redisCommand(["RPUSH", "donations", JSON.stringify(d)]);
      }
      console.log(`[Donations] Cleaned ${allDonations.length - fresh.length} expired`);
    }

    console.log(`[Donations] since=${since} → ${newDonations.length}/${allDonations.length} dikirim ke Roblox`);

    return res.status(200).json({
      donations:  newDonations,
      total:      newDonations.length,
      fetched_at: Math.floor(Date.now() / 1000),
    });

  } catch (err) {
    console.error("[Donations] Redis Error:", err.message);
    return res.status(200).json({
      donations:  [],
      total:      0,
      error:      err.message,
      fetched_at: Math.floor(Date.now() / 1000),
    });
  }
};
