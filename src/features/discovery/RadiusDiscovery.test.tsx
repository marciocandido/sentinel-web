import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import {
  radiusSearchEstablishment,
  radiusSearchPage,
} from "../../test/fixtures";
import { isRadiusSearchPage } from "../../types/api";
import { EMPTY_RADIUS_FORM } from "./radiusTypes";
import { createRadiusSnapshot, validateRadius } from "./radiusUtils";

vi.mock("./RadiusMap", () => ({
  RadiusMap: ({
    data,
  }: {
    data: { radiusKm: number; items: Array<{ razao_social: string | null }> };
  }) => (
    <div role="region" aria-label="Mapa da busca por raio">
      Mapa {data.radiusKm} km · {data.items.map((item) => item.razao_social).join(",")}
    </div>
  ),
}));

const fetchMock = vi.fn();
const catalog = { items: [{ id: "metal", name: "Metal" }] };

function response(body: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("health/live")) {
    return Promise.resolve(response({ status: "ok", service: "sentinel-api" }));
  }
  if (url.includes("catalog/segments")) {
    return Promise.resolve(response(catalog));
  }
  return Promise.resolve(response(radiusSearchPage()));
}

function radiusCalls() {
  return fetchMock.mock.calls.filter(([input]) =>
    input.toString().includes("/radius/establishments"),
  );
}

function radiusUrl(index: number): URL {
  return new URL(radiusCalls()[index][0].toString(), "http://local");
}

async function prepareRadiusSearch() {
  fireEvent.click(screen.getByRole("radio", { name: "Por raio" }));
  fireEvent.change(screen.getByLabelText("Nome do município"), {
    target: { value: "SAO PAULO" },
  });
  fireEvent.change(screen.getByLabelText("UF da origem"), {
    target: { value: "SP" },
  });
  fireEvent.change(screen.getByLabelText("Raio em quilômetros"), {
    target: { value: "10" },
  });
  fireEvent.change(await screen.findByLabelText(/Segmento/), {
    target: { value: "metal" },
  });
  fireEvent.change(screen.getByLabelText("UF dos resultados"), {
    target: { value: "RJ" },
  });
}

function submitRadius() {
  fireEvent.click(screen.getByRole("button", { name: "Buscar por raio" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

describe("Discovery por raio", () => {
  it("shows a third mode and starts with municipality origin", () => {
    render(<App />);
    expect(screen.getByRole("radio", { name: "Por raio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Por raio" }));
    expect(screen.getByLabelText("Tipo de origem")).toHaveValue("municipality");
    expect(screen.getByLabelText("UF da origem")).toBeInTheDocument();
  });

  it("validates municipality, coordinate ranges and finite positive radius", () => {
    expect(validateRadius(EMPTY_RADIUS_FORM)).toMatchObject({
      originMunicipioNome: expect.any(String),
      originUf: expect.any(String),
      radiusKm: expect.any(String),
    });
    for (const radiusKm of ["0", "-1", "NaN", "Infinity"]) {
      expect(
        validateRadius({
          ...EMPTY_RADIUS_FORM,
          originMunicipioNome: "SP",
          originUf: "SP",
          radiusKm,
        }),
      ).toHaveProperty("radiusKm");
    }
    expect(
      validateRadius({
        ...EMPTY_RADIUS_FORM,
        originKind: "coordinates",
        originLat: "91",
        originLon: "-181",
        radiusKm: "1",
      }),
    ).toMatchObject({
      originLat: expect.any(String),
      originLon: expect.any(String),
    });
  });

  it("preserves textual origins and includes only the selected origin", () => {
    const snapshot = createRadiusSnapshot({
      ...EMPTY_RADIUS_FORM,
      originKind: "cnpj",
      originCnpj: "00ABC234000155",
      originCodigoTom: "0001",
      radiusKm: "5",
    });
    expect(snapshot.origin).toEqual({
      kind: "cnpj",
      cnpj: "00ABC234000155",
    });
  });

  it("paginates with the submitted snapshot and resets offset on limit change", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    fetchMock.mockImplementation(
      (input: RequestInfo | URL) => {
        if (!input.toString().includes("radius/establishments")) {
          return defaultApi(input);
        }
        const url = new URL(input.toString(), "http://local");
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        return Promise.resolve(
          response(radiusSearchPage(undefined, { offset, limit, has_more: offset === 0 })),
        );
      },
    );
    render(<App />);
    await prepareRadiusSearch();
    submitRadius();
    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(radiusUrl(0).searchParams.get("offset")).toBe("0");

    fireEvent.change(screen.getByLabelText("Nome do município"), {
      target: { value: "CAMPINAS" },
    });
    const abortsBeforeNext = abortSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText(/Página 2/);
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeNext);
    expect(radiusUrl(1).searchParams.get("offset")).toBe("50");
    expect(radiusUrl(1).searchParams.get("origin_municipio_nome")).toBe(
      "SAO PAULO",
    );
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText(/Página 1/);
    expect(radiusUrl(2).searchParams.get("offset")).toBe("0");

    fireEvent.change(screen.getByLabelText("Resultados por página"), {
      target: { value: "25" },
    });
    await waitFor(() => expect(radiusCalls()).toHaveLength(4));
    expect(radiusUrl(3).searchParams.get("limit")).toBe("25");
    expect(radiusUrl(3).searchParams.get("offset")).toBe("0");
    abortSpy.mockRestore();
  });

  it("retries a failed nonzero page with the exact request", async () => {
    let radiusCount = 0;
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("radius/establishments")) {
        return defaultApi(input);
      }
      radiusCount += 1;
      if (radiusCount === 1) {
        return Promise.resolve(
          response(radiusSearchPage(undefined, { has_more: true })),
        );
      }
      return Promise.resolve(
        response(
          { error: { code: "database_unavailable", message: "private" } },
          503,
        ),
      );
    });
    render(<App />);
    await prepareRadiusSearch();
    submitRadius();
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    const abortsBeforeRetry = abortSpy.mock.calls.length;
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(radiusCalls()).toHaveLength(3));
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeRetry);
    expect(radiusUrl(2).search).toBe(radiusUrl(1).search);
    expect(Object.fromEntries(radiusUrl(2).searchParams)).toMatchObject({
      origin_municipio_nome: "SAO PAULO",
      origin_uf: "SP",
      radius_km: "10",
      segment_id: "metal",
      uf: "RJ",
      limit: "50",
      offset: "50",
    });
    abortSpy.mockRestore();
  });

  it("aborts pending radius requests on mode change, new search and unmount", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (!input.toString().includes("radius/establishments")) {
          return defaultApi(input);
        }
        signals.push(init?.signal as AbortSignal);
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      },
    );
    const view = render(<App />);
    await prepareRadiusSearch();
    fireEvent.submit(
      screen.getByRole("form", { name: "Formulário de busca por raio" }),
    );
    fireEvent.submit(
      screen.getByRole("form", { name: "Formulário de busca por raio" }),
    );
    expect(signals[0].aborted).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Por segmento" }));
    expect(signals[1].aborted).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Por raio" }));
    fireEvent.submit(
      screen.getByRole("form", { name: "Formulário de busca por raio" }),
    );
    view.unmount();
    expect(signals[2].aborted).toBe(true);
  });

  it("ignores an obsolete response that finishes after the latest request", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("radius/establishments")) {
        return defaultApi(input);
      }
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    render(<App />);
    await prepareRadiusSearch();
    submitRadius();
    fireEvent.change(screen.getByLabelText("Nome do município"), {
      target: { value: "CAMPINAS" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Formulário de busca por raio" }),
    );

    await act(async () => {
      resolvers[1](
        response(
          radiusSearchPage([
            radiusSearchEstablishment({ razao_social: "RESULTADO NOVO" }),
          ]),
        ),
      );
    });
    expect(await screen.findByText("RESULTADO NOVO")).toBeInTheDocument();

    await act(async () => {
      resolvers[0](
        response(
          radiusSearchPage(
            [radiusSearchEstablishment({ razao_social: "RESULTADO ANTIGO" })],
            { offset: 50 },
          ),
        ),
      );
    });
    expect(screen.queryByText("RESULTADO ANTIGO")).not.toBeInTheDocument();
    expect(screen.getByText("RESULTADO NOVO")).toBeInTheDocument();
    expect(screen.getByLabelText("Origem resolvida")).toHaveTextContent(
      "SAO PAULO",
    );
    expect(
      screen.getByRole("region", { name: "Mapa da busca por raio" }),
    ).toHaveTextContent("RESULTADO NOVO");
    expect(screen.getByText(/Página 1/)).toBeInTheDocument();
  });
});

describe("guards de raio", () => {
  it("rejects malformed coordinates, distance, booleans, identifiers and status", () => {
    const valid = radiusSearchPage();
    expect(isRadiusSearchPage(valid)).toBe(true);
    const item = valid.items[0];
    const malformed: unknown[] = [
      { ...valid, origin: { ...valid.origin, latitude: Infinity } },
      { ...valid, items: [{ ...item, distance_km: -1 }] },
      { ...valid, items: [{ ...item, has_geo: 1 }] },
      { ...valid, items: [{ ...item, cnpj_full: 123 }] },
      { ...valid, items: [{ ...item, commercial_status: "CLIENT" }] },
    ];
    for (const page of malformed) {
      expect(isRadiusSearchPage(page)).toBe(false);
    }
  });
});
