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

function normalize(d) {
  if (!d || typeof d !== "object") return null;

  let ts = Number(d.timestamp);
  if (!ts || !isFinite(ts)) ts = Math.floor(Date.now() / 1000);
  if (ts > 1e12) ts = Math.floor(ts / 1000);

  let amount = d.amount;
  if (typeof amount !== "number") {
    amount = Number(String(amount ?? "").replace(/[^\d]/g, ""));
  }
  if (!amount || !isFinite(amount) || amount <= 0) return null;

  const name = String(d.name || d.donator_name || d.donor_name || "Anonymous");
  const id = String(d.id || `${name}_${ts}_${amount}`);

  return {
    id,
    name,
    amount,
    message: String(d.message ?? d.note ?? ""),
    timestamp: ts,
    userId: d.userId ? Number(d.userId) : undefined,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const since = parseInt(req.query.since || "0", 10) || 0;

  try {
    const raw = await redisCommand(["LRANGE", "donations", "0", "499"]);

    if (!raw || raw.length === 0) {
      return res.status(200).json({
        donations:  [],
        total:      0,
        fetched_at: Math.floor(Date.now() / 1000),
      });
    }

    const entries = [];
    for (const item of raw) {
      let obj = item;
      if (typeof item === "string") {
        try { obj = JSON.parse(item); } catch { obj = null; }
      }
      const d = normalize(obj);
      if (d) entries.push({ raw: item, d });
    }

    const newDonations = entries
      .map(e => e.d)
      .filter(d => d.timestamp > since)
      .sort((a, b) => a.timestamp - b.timestamp);

    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const expired = entries.filter(e => e.d.timestamp < oneHourAgo && typeof e.raw === "string");
    for (const e of expired) {
      try { await redisCommand(["LREM", "donations", "0", e.raw]); } catch {}
    }

    return res.status(200).json({
      donations:  newDonations,
      total:      newDonations.length,
      fetched_at: Math.floor(Date.now() / 1000),
    });

  } catch (err) {
    return res.status(200).json({
      donations:  [],
      total:      0,
      error:      err.message,
      fetched_at: Math.floor(Date.now() / 1000),
    });
  }
};
