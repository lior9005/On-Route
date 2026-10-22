import { buildStreetQuery, OVERPASS_SERVERS } from "../../src/utils/overpassQuery";

/**
 * GET /.netlify/functions/streets?lat=..&lon=..&radius=..
 *
 * Server-side proxy to OpenStreetMap's Overpass API: browsers cannot call the
 * public Overpass servers reliably (CORS / blocked requests). Only builds the
 * street query itself, so it cannot be used to run arbitrary queries.
 * Responses are cached on Netlify's CDN for a week.
 */

const MAX_RADIUS = 3000;
// Start the next server if the previous one has not answered by then
const HEDGE_DELAY_MS = 3000;
// Stay under Netlify's 10s function limit
const TOTAL_TIMEOUT_MS = 9000;

export default async (req: Request): Promise<Response> => {
  const params = new URL(req.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const radius = Number(params.get("radius"));

  if (
    !Number.isFinite(lat) || Math.abs(lat) > 90 ||
    !Number.isFinite(lon) || Math.abs(lon) > 180 ||
    !Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS
  ) {
    return json({ error: "Expected lat, lon and radius (meters, max 3000)" }, 400);
  }

  const query = buildStreetQuery({ lat, lon }, radius);

  try {
    const data = await queryFirstAvailable(query);
    return json(data, 200, {
      // Browsers revalidate; Netlify's CDN keeps the answer for a week
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=604800",
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
};

/**
 * Ask the servers one after another (each next one starts if the previous
 * is slow or fails); the first successful answer wins.
 */
async function queryFirstAvailable(query: string): Promise<unknown> {
  const controllers = OVERPASS_SERVERS.map(() => new AbortController());
  const errors: string[] = [];
  const deadline = setTimeout(
    () => controllers.forEach((c) => c.abort()),
    TOTAL_TIMEOUT_MS,
  );

  try {
    return await new Promise((resolve, reject) => {
      let pending = OVERPASS_SERVERS.length;
      let started = 0;
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const startNext = () => {
        clearTimeout(hedgeTimer);
        if (settled || started >= OVERPASS_SERVERS.length) return;
        const i = started++;
        const server = OVERPASS_SERVERS[i];
        hedgeTimer = setTimeout(startNext, HEDGE_DELAY_MS);

        fetch(server, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "OnTheWay/1.0 (https://github.com/lior9005/On-Route)",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controllers[i].signal,
        })
          .then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (settled) return;
            settled = true;
            clearTimeout(hedgeTimer);
            controllers.forEach((c, j) => j !== i && c.abort());
            resolve(data);
          })
          .catch((err) => {
            if (settled) return;
            const reason = err?.name === "AbortError" ? "timed out" : err?.message ?? String(err);
            errors.push(`${new URL(server).hostname}: ${reason}`);
            if (--pending === 0) {
              settled = true;
              reject(new Error(`OpenStreetMap unavailable (${errors.join("; ")})`));
            } else {
              startNext(); // Failed fast: try the next server right away
            }
          });
      };

      startNext();
    });
  } finally {
    clearTimeout(deadline);
  }
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
