import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runtimeNeighborsPage,
  runtimeRadiusPage,
} from "../../test/discoveryRuntimeFixtures";
import { createRadiusMapController } from "./radiusMapAdapter";

// Sem mock do Leaflet: a primeira atualização acontece antes de o mapa ter
// qualquer view, exatamente como no runtime real (issue #50).
describe("radius map adapter with real Leaflet", () => {
  const containers: HTMLElement[] = [];

  afterEach(() => {
    containers.splice(0).forEach((container) => container.remove());
  });

  function mount() {
    const container = document.createElement("div");
    document.body.append(container);
    containers.push(container);
    return createRadiusMapController(container, {
      tileUrl: "data:image/png;base64,{z}{x}{y}",
      attribution: "attribution",
      onTileFailure: vi.fn(),
    });
  }

  it("renders the first real radius payload on a map without a view", () => {
    const controller = mount();
    const page = runtimeRadiusPage();

    expect(() =>
      controller.update({ origin: page.origin, radiusKm: 10, items: page.items }),
    ).not.toThrow();
    expect(() =>
      controller.update({ origin: page.origin, radiusKm: 20, items: [] }),
    ).not.toThrow();
    controller.destroy();
  });

  it("renders the first real neighbors payload on a map without a view", () => {
    const controller = mount();
    const page = runtimeNeighborsPage();

    expect(() =>
      controller.update({ origin: page.origin, radiusKm: 10, items: page.items }),
    ).not.toThrow();
    controller.destroy();
  });

  it("can be recreated on the same container after destroy (StrictMode)", () => {
    const container = document.createElement("div");
    document.body.append(container);
    containers.push(container);
    const options = { tileUrl: "tiles", attribution: "a", onTileFailure: vi.fn() };
    const page = runtimeRadiusPage();
    const data = { origin: page.origin, radiusKm: 10, items: page.items };

    const first = createRadiusMapController(container, options);
    first.update(data);
    first.destroy();
    const second = createRadiusMapController(container, options);
    expect(() => second.update(data)).not.toThrow();
    second.destroy();
  });
});
