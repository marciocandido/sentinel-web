import type { RadiusMapOptions } from "./radiusMapAdapter";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function radiusMapOptions(
  env: Pick<
    ImportMetaEnv,
    "VITE_SENTINEL_MAP_TILE_URL" | "VITE_SENTINEL_MAP_ATTRIBUTION"
  >,
  onTileFailure: () => void,
): RadiusMapOptions {
  return {
    tileUrl: env.VITE_SENTINEL_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL,
    attribution:
      env.VITE_SENTINEL_MAP_ATTRIBUTION?.trim() || DEFAULT_ATTRIBUTION,
    onTileFailure,
  };
}
