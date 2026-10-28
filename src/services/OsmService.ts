import { VectorTile, VectorTileFeature } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { Coordinates } from "../models";
import { CONFIG } from "../constants/config";
import { distanceToPolyline } from "../utils/distance";

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

const TILE_ZOOM = 14; // Highest zoom with full street detail (~2.4km tiles)
// Max distance between a street and its name label line
const NAME_MATCH_METERS = 15;

/**
 * OpenStreetMap street data from OpenFreeMap vector tiles (OpenMapTiles
 * schema): a free CDN that browsers can call directly. Google APIs do not
 * expose road types, so OSM tells small streets from big roads.
 */
export class OsmService {
  private tileJsonUrl = "https://tiles.openfreemap.org/planet";
  private tileUrlTemplate: Promise<string> | null = null;

  /**
   * Fetch small streets and big roads around a location
   */
  async fetchStreetNetwork(
    center: Coordinates,
    radius: number,
  ): Promise<StreetNetwork> {
    const template = await this.getTileUrlTemplate();
    const reach = radius + CONFIG.BIG_ROAD_BUFFER_METERS;
    const tiles = tilesCovering(center, reach, TILE_ZOOM);

    const decoded = await Promise.all(
      tiles.map(async ({ x, y }) => {
        const url = template
          .replace("{z}", String(TILE_ZOOM))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        const buffer = await this.fetchWithTimeout(url).then((r) => r.arrayBuffer());
        return { x, y, tile: new VectorTile(new Pbf(buffer)) };
      }),
    );

    const smallTypes = new Set<string>(CONFIG.SMALL_STREET_CLASSES);
    const bigTypes = new Set<string>(CONFIG.BIG_ROAD_CLASSES);
    const network: StreetNetwork = { smallStreets: [], bigRoads: [] };
    const labels: Array<{ name: string; geometry: Coordinates[] }> = [];
    let nextId = 1;

    for (const { x, y, tile } of decoded) {
      const roads = tile.layers.transportation;
      for (let i = 0; roads && i < roads.length; i++) {
        const feature = roads.feature(i);
        const roadClass = String(feature.properties.class ?? "");
        const isSmall = smallTypes.has(roadClass);
        if (!isSmall && !bigTypes.has(roadClass)) continue;

        for (const line of lineStrings(feature, x, y)) {
          const way: OsmWay = {
            id: nextId++,
            highway: roadClass,
            geometry: line,
            nodeIds: line.map(nodeId),
          };
          (isSmall ? network.smallStreets : network.bigRoads).push(way);
        }
      }

      const names = tile.layers.transportation_name;
      for (let i = 0; names && i < names.length; i++) {
        const feature = names.feature(i);
        const p = feature.properties;
        // Local name first (Hebrew in Israel), to match the stop names
        const name = String(p.name ?? p["name:en"] ?? p.name_en ?? "");
        if (!name) continue;
        for (const line of lineStrings(feature, x, y)) {
          labels.push({ name, geometry: line });
        }
      }
    }

    // Street names live in a separate layer: give each small street the
    // name of the label line running along it
    for (const way of network.smallStreets) {
      const mid = way.geometry[Math.floor(way.geometry.length / 2)];
      let best: { name: string; distance: number } | null = null;
      for (const label of labels) {
        const distance = distanceToPolyline(mid, label.geometry);
        if (distance <= NAME_MATCH_METERS && (!best || distance < best.distance)) {
          best = { name: label.name, distance };
        }
      }
      way.name = best?.name;
    }

    return network;
  }

  /**
   * Tile URL template from OpenFreeMap's TileJSON (it changes with each data release)
   */
  private getTileUrlTemplate(): Promise<string> {
    if (!this.tileUrlTemplate) {
      this.tileUrlTemplate = this.fetchWithTimeout(this.tileJsonUrl)
        .then((r) => r.json())
        .then((tileJson) => {
          const template = tileJson?.tiles?.[0];
          if (typeof template !== "string") {
            throw new Error("No tile URL in TileJSON");
          }
          return template;
        })
        .catch((err) => {
          this.tileUrlTemplate = null; // Retry on the next search
          throw err;
        });
    }
    return this.tileUrlTemplate;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.OSM_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`OpenFreeMap ${new URL(url).pathname}: HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("OpenFreeMap timed out");
      }
      if (err instanceof Error && !err.message.startsWith("OpenFreeMap")) {
        throw new Error(`OpenFreeMap unreachable (${err.message})`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Tiles (x, y) at `zoom` covering a circle of `radius` meters around `center`
 */
export function tilesCovering(
  center: Coordinates,
  radius: number,
  zoom: number,
): Array<{ x: number; y: number }> {
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const [x0, y0] = tileOf(center.lat + dLat, center.lon - dLon, zoom);
  const [x1, y1] = tileOf(center.lat - dLat, center.lon + dLon, zoom);

  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

function tileOf(lat: number, lon: number, zoom: number): [number, number] {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return [x, y];
}

/**
 * Line geometries of a tile feature as coordinate lists
 */
function lineStrings(feature: VectorTileFeature, x: number, y: number): Coordinates[][] {
  const geojson = feature.toGeoJSON(x, y, TILE_ZOOM);
  const toCoords = (line: number[][]) => line.map(([lon, lat]) => ({ lat, lon }));

  if (geojson.geometry.type === "LineString") {
    return [toCoords(geojson.geometry.coordinates as number[][])];
  }
  if (geojson.geometry.type === "MultiLineString") {
    return (geojson.geometry.coordinates as number[][][]).map(toCoords);
  }
  return [];
}

/**
 * Stable id for a vertex: streets meeting at a corner share the exact
 * tile coordinate, so equal ids mark an intersection
 */
function nodeId(c: Coordinates): number {
  const lat = Math.round(c.lat * 1e6);
  const lon = Math.round(c.lon * 1e6);
  return lat * 1e9 + lon;
}
