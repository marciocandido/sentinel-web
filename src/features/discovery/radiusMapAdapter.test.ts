import { beforeEach, describe, expect, it, vi } from "vitest";
import { radiusSearchEstablishment, radiusSearchOrigin } from "../../test/fixtures";

const mocks = vi.hoisted(() => ({ fitBounds: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn(), clearLayers: vi.fn(), radius: vi.fn(), bindTooltip: vi.fn(), tileHandlers: new Map<string, () => void>() }));
vi.mock("leaflet", () => {
  const bounds = { extend: vi.fn() };
  const layer = { addTo: vi.fn(function (this: unknown) { return this; }), bindTooltip: mocks.bindTooltip, getLatLng: () => ({ lat: 1, lng: 1 }) };
  const circle = { ...layer, getBounds: () => bounds };
  const tile = { addTo: vi.fn(), on: vi.fn((name: string, callback: () => void) => mocks.tileHandlers.set(name, callback)), off: vi.fn() };
  return { default: { map: vi.fn(() => ({ fitBounds: mocks.fitBounds, invalidateSize: mocks.invalidateSize, remove: mocks.remove })), tileLayer: vi.fn(() => tile), layerGroup: vi.fn(() => ({ addTo: vi.fn(function (this: unknown) { return this; }), clearLayers: mocks.clearLayers })), latLng: vi.fn((lat, lng) => ({ lat, lng })), circleMarker: vi.fn(() => layer), circle: vi.fn((_center: unknown, options: { radius: number }) => { mocks.radius(options.radius); return circle; }) } };
});

import { createRadiusMapController } from "./radiusMapAdapter";

describe("radius map adapter", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.tileHandlers.clear(); });
  it("draws km as meters, fits bounds, uses DOM tooltip and destroys the map", () => {
    const controller = createRadiusMapController(document.createElement("div"), { tileUrl: "tiles/{z}", attribution: "© Test", onTileFailure: vi.fn() });
    controller.update({ origin: radiusSearchOrigin(), radiusKm: 10, items: [radiusSearchEstablishment()] });
    expect(mocks.radius).toHaveBeenCalledWith(10000);
    expect(mocks.fitBounds).toHaveBeenCalled();
    expect(mocks.invalidateSize).toHaveBeenCalled();
    expect(mocks.bindTooltip.mock.calls.some(([content]) => content instanceof HTMLElement)).toBe(true);
    controller.destroy(); expect(mocks.clearLayers).toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalled();
  });
  it("reports repeated tile failures without affecting layers", () => { const failure = vi.fn(); createRadiusMapController(document.createElement("div"), { tileUrl: "tiles", attribution: "attr", onTileFailure: failure }); const handler = mocks.tileHandlers.get("tileerror")!; handler(); handler(); expect(failure).not.toHaveBeenCalled(); handler(); expect(failure).toHaveBeenCalledOnce(); });
});
