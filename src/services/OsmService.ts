import { Coordinates } from "../models";
import { CONFIG } from "../constants/config";

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
 * OpenStreetMap street data via the public Overpass API.
 * Google APIs do not expose road types, so OSM tells small streets from big roads.
 */
export class OsmService {
  private overpassUrl = "https://overpass-api.de/api/interpreter";

  /**
   * Fetch small streets and big roads around a location
   */
  async fetchStreetNetwork(
    center: Coordinates,
    radius: number,
  ): Promise<StreetNetwork> {
    const small = CONFIG.SMALL_STREET_TYPES.join("|");
    const big = CONFIG.BIG_ROAD_TYPES.join("|");
    // Big roads are searched a bit wider so points near the edge are still checked
    const bigRadius = Math.round(radius + CONFIG.BIG_ROAD_BUFFER_METERS);
    const around = (r: number) => `around:${Math.round(r)},${center.lat},${center.lon}`;

    const query = `[out:json][timeout:10];(
      way(${around(radius)})["highway"~"^(${small})$"];
      way(${around(bigRadius)})["highway"~"^(${big})$"];
    );out body geom;`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      CONFIG.OSM_TIMEOUT_MS,
    );

    try {
      // Form-encoded POST is a "simple" CORS request (no preflight)
      const response = await fetch(this.overpassUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Overpass request failed: ${response.status}`);
      }

      const data = await response.json();
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
    } finally {
      clearTimeout(timeout);
    }
  }
}
