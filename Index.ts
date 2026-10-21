// Supabase Edge Function: video feed proxy for sqservices.me
// Replaces feed.php. Deploy with:  supabase functions deploy feed --no-verify-jwt

const ALLOWED = ["featured", "newest", "mostviewed", "rating"];
const cache = new Map<string, { t: number; body: string }>();

Deno.serve(async (req: Request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const q = new URL(req.url).searchParams;
  const search = (q.get("search") ?? "").trim().slice(0, 60);
  const page = Math.min(50, Math.max(1, parseInt(q.get("page") ?? "1", 10) || 1));
  const ordering = ALLOWED.includes(q.get("ordering") ?? "") ? q.get("ordering")! : "mostviewed";

  const params = new URLSearchParams({ page: String(page), ordering, thumbsize: "large" });
  if (search) params.set("search", search);
  const url = "https://www.pornhub.com/webmasters/search?" + params.toString();

  // Keep each result for 10 minutes so the feed stays fast
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 600_000) return new Response(hit.body, { headers });

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "sqservices.me video feed" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await r.text();
    if (!r.ok) throw new Error("bad status");
    JSON.parse(body); // make sure it really is JSON
    cache.set(url, { t: Date.now(), body });
    return new Response(body, { headers });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Feed unavailable" }), { status: 502, headers });
  }
});
