/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTINEL_MAP_TILE_URL?: string;
  readonly VITE_SENTINEL_MAP_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
