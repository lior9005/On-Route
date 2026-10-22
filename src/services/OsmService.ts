import { Coordinates } from "../models";
import { Platform } from "react-native";
import { CONFIG } from "../constants/config";
import { buildStreetQuery, OVERPASS_SERVERS } from "../utils/overpassQuery";

export interface OsmWay {
  id: number;
  name?: string;
  highway: string;
  nodeIds: number[];
  geometry: Coordinates[];
}

export interface StreetNetwork {
  /** Small streets suitable for a pick-up/drop-off */
  smallStreets: OsmWay[];
  /** Big roads (highways, main roads) that points must keep away from */
  bigRoads: OsmWay[];
}

/**
 * OpenStreetMap street data via the Overpass API.
 * Google APIs do not expose road types, so OSM tells small streets from big roads.
 *
 * Goes through the site's Netlify function first (browsers cannot reliably
 * call the public Overpass servers), then the public servers directly.
 */
export class OsmService {
  private proxyUrl =
    process.env.EXPO_PUBLIC_STREETS_API_URL ||
    (Platform.OS === "web"
      ? "/.netlify/functions/streets"
      : "https://on-route.netlify.app/.netlify/functions/streets");

  /**
   * Fetch small streets and big roads around a location
   */
  async fetchStreetNetwork(
    center: Coordinates,
    radius: number,
  ): Promise<StreetNetwork> {
    const data = await this.fetchOverpassData(center, Math.round(radius));
    const smallTypes = new Set<string>(CONFIG.SMALL_STREET_TYPES);
    const network: StreetNetwork = { smallStreets: [], bigRoads: [] };

    for (const el of data.elements ?? []) {
      if (el.type !== "way" || !el.geometry || !el.tags?.highway) continue;

      const way: OsmWay = {
        id: el.id,
        name: el.tags["name:en"] || el.tags.name,
        highway: el.tags.highway,
        nodeIds: el.nodes ?? [],
        geometry: el.geometry.map((g: any) => ({ lat: g.lat, lon: g.lon })),
      };

      if (smallTypes.has(way.highway)) {
        network.smallStreets.push(way);
      } else {
        network.bigRoads.push(way);
      }
    }

    return network;
  }

  /**
   * Overpass JSON from the proxy function, falling back to public servers
   */
  private async fetchOverpassData(center: Coordinates, radius: number): Promise<any> {
    const errors: string[] = [];

    // ~10m precision keeps nearby searches on the same cached response
    const lat = center.lat.toFixed(4);
    const lon = center.lon.toFixed(4);
    try {
      return await this.fetchJson(
        `${this.proxyUrl}?lat=${lat}&lon=${lon}&radius=${radius}`,
        { method: "GET" },
        CONFIG.OSM_TIMEOUT_MS,
      );
    } catch (err) {
      errors.push(`proxy: ${this.reason(err)}`);
    }

    const query = buildStreetQuery({ lat: Number(lat), lon: Number(lon) }, radius);
    for (const url of OVERPASS_SERVERS.slice(0, 2)) {
      try {
        // Form-encoded POST is a "simple" CORS request (no preflight)
        return await this.fetchJson(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `data=${encodeURIComponent(query)}`,
          },
          CONFIG.OSM_DIRECT_TIMEOUT_MS,
        );
      } catch (err) {
        errors.push(`${new URL(url).hostname}: ${this.reason(err)}`);
      }
    }

    throw new Error(`OpenStreetMap unavailable (${errors.join("; ")})`);
  }

  private async fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private reason(err: unknown): string {
    if (err instanceof Error && err.name === "AbortError") return "timed out";
    return err instanceof Error ? err.message : String(err);
  }
}
