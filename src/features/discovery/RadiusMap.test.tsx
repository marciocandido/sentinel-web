import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  radiusSearchEstablishment,
  radiusSearchOrigin,
  radiusSearchPage,
} from "../../test/fixtures";
import { RadiusResults } from "./RadiusResults";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  options: undefined as { onTileFailure: () => void } | undefined,
}));

vi.mock("./radiusMapAdapter", () => ({
  createRadiusMapController: vi.fn(
    (_container: HTMLElement, options: { onTileFailure: () => void }) => {
      mocks.create();
      mocks.options = options;
      return { update: mocks.update, destroy: mocks.destroy };
    },
  ),
}));

import { RadiusMap } from "./RadiusMap";
import { radiusMapOptions } from "./radiusMapConfig";

const data = {
  origin: radiusSearchOrigin(),
  radiusKm: 10,
  items: [radiusSearchEstablishment()],
};

describe("RadiusMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options = undefined;
  });

  it("uses linked default attribution and preserves custom configuration", () => {
    const fallback = radiusMapOptions({}, vi.fn());
    expect(fallback.attribution).toContain("OpenStreetMap");
    expect(fallback.attribution).toContain(
      "https://www.openstreetmap.org/copyright",
    );

    const custom = radiusMapOptions(
      {
        VITE_SENTINEL_MAP_TILE_URL: " https://tiles.example/{z} ",
        VITE_SENTINEL_MAP_ATTRIBUTION: " Custom provider attribution ",
      },
      vi.fn(),
    );
    expect(custom).toMatchObject({
      tileUrl: "https://tiles.example/{z}",
      attribution: "Custom provider attribution",
    });
  });

  it("creates once, updates without recreating and destroys on unmount", () => {
    const view = render(<RadiusMap data={data} />);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledOnce();

    view.rerender(<RadiusMap data={{ ...data, radiusKm: 20, items: [] }} />);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("shows tile failure locally without removing origin, table or results", () => {
    render(
      <RadiusResults
        state={{
          kind: "success",
          page: radiusSearchPage(),
          snapshot: {
            origin: { kind: "municipality", municipioNome: "SAO PAULO", uf: "SP" },
            radiusKm: 10,
            segmentId: "",
            resultUf: "",
          },
        }}
        onRetry={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onLimitChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    act(() => mocks.options?.onTileFailure());

    expect(
      screen.getByText(
        "O mapa-base não pôde ser carregado. Os resultados e posições continuam disponíveis na tabela.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Origem resolvida")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("EMPRESA EXEMPLO LTDA")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
