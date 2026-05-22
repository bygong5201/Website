const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function normalizeLocation(request) {
  const cf = request.cf || {};
  const country = cf.country || "Unknown";
  const city = cf.city || "";
  const region = cf.region || "";
  const latitude = Number(cf.latitude);
  const longitude = Number(cf.longitude);

  return {
    label: city || region || country,
    city,
    region,
    country,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    count: 1
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname !== "/visitors") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (!env.VISITOR_MAP_KV) {
      return jsonResponse({ error: "Missing VISITOR_MAP_KV binding" }, 500);
    }

    const stored = await env.VISITOR_MAP_KV.get("locations", "json");
    const locations = Array.isArray(stored) ? stored : [];

    if (request.method === "GET") {
      return jsonResponse({ locations });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const location = normalizeLocation(request);
    const key = [location.city, location.region, location.country].filter(Boolean).join("|") || "Unknown";
    const existing = locations.find((item) => item.key === key);

    if (existing) {
      existing.count = Number(existing.count || 0) + 1;
    } else {
      locations.push({ key, ...location });
    }

    locations.sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
    await env.VISITOR_MAP_KV.put("locations", JSON.stringify(locations.slice(0, 250)));

    return jsonResponse({ ok: true });
  }
};
