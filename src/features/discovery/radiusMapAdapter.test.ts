import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  radiusSearchEstablishment,
  radiusSearchOrigin,
} from "../../test/fixtures";

const mocks = vi.hoisted(() => ({
  map: vi.fn(),
  tileLayer: vi.fn(),
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
  remove: vi.fn(),
  clearLayers: vi.fn(),
  radius: vi.fn(),
  bindTooltip: vi.fn(),
  tileOff: vi.fn(),
  tileHandlers: new Map<string, () => void>(),
}));

vi.mock("leaflet", () => {
  const bounds = { extend: vi.fn() };
  const layer = {
    addTo: vi.fn(function (this: unknown) {
      return this;
    }),
    bindTooltip: mocks.bindTooltip,
    getLatLng: () => ({ lat: 1, lng: 1 }),
  };
  const circle = { ...layer, getBounds: () => bounds };
  const tile = {
    addTo: vi.fn(),
    on: vi.fn((name: string, callback: () => void) =>
      mocks.tileHandlers.set(name, callback),
    ),
    off: mocks.tileOff,
  };
  mocks.map.mockImplementation(() => ({
    fitBounds: mocks.fitBounds,
    invalidateSize: mocks.invalidateSize,
    remove: mocks.remove,
  }));
  mocks.tileLayer.mockReturnValue(tile);
  return {
    default: {
      map: mocks.map,
      tileLayer: mocks.tileLayer,
      layerGroup: vi.fn(() => ({
        addTo: vi.fn(function (this: unknown) {
          return this;
        }),
        clearLayers: mocks.clearLayers,
      })),
      latLng: vi.fn((lat, lng) => ({ lat, lng })),
      circleMarker: vi.fn(() => layer),
      circle: vi.fn((_center: unknown, options: { radius: number }) => {
        mocks.radius(options.radius);
        return circle;
      }),
    },
  };
});

import { createRadiusMapController } from "./radiusMapAdapter";

describe("radius map adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tileHandlers.clear();
  });

  it("creates once, replaces layers, recalculates bounds and destroys resources", () => {
    const controller = createRadiusMapController(document.createElement("div"), {
      tileUrl: "tiles/{z}",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      onTileFailure: vi.fn(),
    });
    const first = {
      origin: radiusSearchOrigin(),
      radiusKm: 10,
      items: [radiusSearchEstablishment()],
    };

    controller.update(first);
    controller.update({ ...first, radiusKm: 20, items: [] });

    expect(mocks.map).toHaveBeenCalledOnce();
    expect(mocks.radius).toHaveBeenNthCalledWith(1, 10000);
    expect(mocks.radius).toHaveBeenNthCalledWith(2, 20000);
    expect(mocks.clearLayers).toHaveBeenCalledTimes(2);
    expect(mocks.fitBounds).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateSize).toHaveBeenCalledTimes(2);
    expect(mocks.clearLayers.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.radius.mock.invocationCallOrder[0],
    );
    expect(mocks.clearLayers.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.radius.mock.invocationCallOrder[1],
    );

    controller.destroy();
    expect(mocks.tileOff).toHaveBeenCalled();
    expect(mocks.clearLayers).toHaveBeenCalledTimes(3);
    expect(mocks.remove).toHaveBeenCalled();
  });

  it("passes visible linked attribution to the tile layer", () => {
    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    createRadiusMapController(document.createElement("div"), {
      tileUrl: "tiles",
      attribution,
      onTileFailure: vi.fn(),
    });
    const options = mocks.tileLayer.mock.calls[0][1];
    expect(options.attribution).toContain("OpenStreetMap");
    expect(options.attribution).toContain(
      "https://www.openstreetmap.org/copyright",
    );
  });

  it("keeps remote tooltip content as text in an HTMLElement", () => {
    const controller = createRadiusMapController(document.createElement("div"), {
      tileUrl: "tiles",
      attribution: "attribution",
      onTileFailure: vi.fn(),
    });
    controller.update({
      origin: radiusSearchOrigin(),
      radiusKm: 1,
      items: [
        radiusSearchEstablishment({
          razao_social: '<img src=x onerror="alert(1)">',
        }),
      ],
    });
    const tooltip = mocks.bindTooltip.mock.calls.find(
      ([content]) => content instanceof HTMLElement,
    )?.[0] as HTMLElement;
    expect(tooltip).toBeInstanceOf(HTMLElement);
    expect(tooltip.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(tooltip.querySelector("img")).toBeNull();
  });

  it("reports only the third repeated tile failure", () => {
    const failure = vi.fn();
    createRadiusMapController(document.createElement("div"), {
      tileUrl: "tiles",
      attribution: "attr",
      onTileFailure: failure,
    });
    const handler = mocks.tileHandlers.get("tileerror")!;
    handler();
    handler();
    expect(failure).not.toHaveBeenCalled();
    handler();
    expect(failure).toHaveBeenCalledOnce();
  });
});
