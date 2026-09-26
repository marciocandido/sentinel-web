import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import {
  runtimeNeighborsPage,
  runtimeRadiusOrigin,
  runtimeRadiusPage,
  runtimeRegionPage,
} from "../../test/discoveryRuntimeFixtures";
import { runtimeStatus } from "../../test/runtimeFixtures";
import {
  isDiscoveryEstablishmentPage,
  isNeighborSearchPage,
  isRadiusSearchPage,
} from "../../types/api";
import { chooseFamily, chooseProximity, chooseRadiusOrigin } from "../../test/discoveryUi";

// Issue #50: sem mock de RadiusMap nem de Leaflet, exceto quando o teste força
// explicitamente uma falha para verificar o isolamento.
const failures = vi.hoisted(() => ({ map: false, table: false }));

vi.mock("./radiusMapAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./radiusMapAdapter")>();
  return {
    ...actual,
    createRadiusMapController: (
      ...args: Parameters<typeof actual.createRadiusMapController>
    ) => {
      const controller = actual.createRadiusMapController(...args);
      return {
        update: (data: Parameters<typeof controller.update>[0]) => {
          if (failures.map) throw new Error("falha forçada do mapa");
          controller.update(data);
        },
        destroy: () => controller.destroy(),
      };
    },
  };
});

vi.mock("./ResultsCollection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ResultsCollection")>();
  return {
    ...actual,
    ResultsCollection: (props: Parameters<typeof actual.ResultsCollection>[0]) => {
      if (failures.table) throw new Error("falha forçada da tabela");
      return <actual.ResultsCollection {...props} />;
    },
  };
});

const fetchMock = vi.fn();

function response(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: () => Promise.resolve(body) } as Response;
}

function api(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/api/v1/runtime/status")) return Promise.resolve(response(runtimeStatus()));
  if (url.includes("catalog/segments")) return Promise.resolve(response({ items: [] }));
  if (url.includes("/discovery/establishments?")) return Promise.resolve(response(runtimeRegionPage()));
  if (url.includes("origin_cnpj=")) {
    return Promise.resolve(
      response(runtimeRadiusPage(runtimeRadiusOrigin({ kind: "CNPJ", cnpj_full: "00A00002000120" }))),
    );
  }
  if (url.includes("/radius/establishments")) return Promise.resolve(response(runtimeRadiusPage()));
  if (url.includes("/neighbors")) return Promise.resolve(response(runtimeNeighborsPage()));
  return Promise.reject(new Error(`URL inesperada: ${url}`));
}

function discoveryCalls(fragment: string) {
  return fetchMock.mock.calls.filter(([input]) => input.toString().includes(fragment));
}

function expectShellAndFiltersMounted() {
  expect(screen.getByRole("complementary", { name: "Navegação principal" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Buscar empresas" })).toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "Tipo de busca" })).toBeInTheDocument();
}

async function searchRegion() {
  await chooseFamily("Filtros");
  fireEvent.change(screen.getByLabelText(/^UF \(opcional\)/), { target: { value: "SP" } });
  fireEvent.change(screen.getByLabelText(/^Município/), { target: { value: "Campinas" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

async function searchRadius(origin: "municipality" | "cnpj") {
  await chooseProximity("Raio a partir de uma origem");
  if (origin === "cnpj") {
    chooseRadiusOrigin("CNPJ");
    fireEvent.change(screen.getByLabelText("CNPJ de origem"), { target: { value: "00A00002000120" } });
  } else {
    fireEvent.change(screen.getByLabelText("Município de origem"), { target: { value: "Campinas" } });
    fireEvent.change(screen.getByLabelText("UF da origem"), { target: { value: "SP" } });
  }
  fireEvent.change(screen.getByLabelText("Raio (km)"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

async function searchNeighbors() {
  await chooseProximity("Vizinhos de um CNPJ");
  fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "00A00002000120" } });
  fireEvent.change(screen.getByLabelText("Raio (km)"), { target: { value: "10" } });
  fireEvent.submit(screen.getByRole("form", { name: "Critérios da busca" }));
}

beforeEach(() => {
  failures.map = false;
  failures.table = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(api);
  vi.stubGlobal("fetch", fetchMock);
});

describe("Discovery com payloads reais do runtime (issue #50)", () => {
  it("keeps the runtime-shaped fixtures valid for the public validators", () => {
    expect(isDiscoveryEstablishmentPage(runtimeRegionPage())).toBe(true);
    expect(isRadiusSearchPage(runtimeRadiusPage())).toBe(true);
    expect(isNeighborSearchPage(runtimeNeighborsPage())).toBe(true);
  });

  it("renders a realistic region result", async () => {
    render(<App />);
    await searchRegion();
    expect((await screen.findAllByText("00.A00.001 EMPRESA INDIVIDUAL SINTETICA")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expectShellAndFiltersMounted();
  });

  it.each(["municipality", "cnpj"] as const)(
    "renders a realistic radius result with the real map (origin %s)",
    async (origin) => {
      render(<App />);
      await searchRadius(origin);
      expect(await screen.findByText("019 REGIAO SINTETICA SERVICOS LTDA")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Mapa da busca por raio" })).toBeInTheDocument();
      expect(screen.queryByText(/O mapa não pôde ser exibido/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Não foi possível exibir os resultados/)).not.toBeInTheDocument();
      expectShellAndFiltersMounted();
    },
  );

  it("renders a realistic neighbors result with the real map", async () => {
    render(<App />);
    await searchNeighbors();
    expect(await screen.findByText("019 REGIAO SINTETICA SERVICOS LTDA")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mapa dos estabelecimentos vizinhos" })).toBeInTheDocument();
    expect(screen.queryByText(/O mapa não pôde ser exibido/)).not.toBeInTheDocument();
    expectShellAndFiltersMounted();
  });

  it("keeps the radius table when the map adapter fails", async () => {
    failures.map = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await searchRadius("municipality");
    expect(await screen.findByText(/O mapa não pôde ser exibido/)).toBeInTheDocument();
    expect(screen.getByText("019 REGIAO SINTETICA SERVICOS LTDA")).toBeInTheDocument();
    expect(screen.getByLabelText("Origem resolvida")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mapa da busca por raio" })).not.toBeInTheDocument();
    expectShellAndFiltersMounted();
  });

  it("keeps the neighbors table when the map adapter fails", async () => {
    failures.map = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await searchNeighbors();
    expect(await screen.findByText(/O mapa não pôde ser exibido/)).toBeInTheDocument();
    expect(screen.getByText("019 REGIAO SINTETICA SERVICOS LTDA")).toBeInTheDocument();
    expectShellAndFiltersMounted();
  });

  it("contains a results render failure and retries the submitted search", async () => {
    failures.table = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await searchRegion();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível exibir os resultados desta busca");
    expectShellAndFiltersMounted();
    expect(screen.getByLabelText(/^UF \(opcional\)/)).toHaveValue("SP");
    expect(screen.getByLabelText(/^Município/)).toHaveValue("Campinas");
    expect(discoveryCalls("/discovery/establishments?")).toHaveLength(1);

    failures.table = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect((await screen.findAllByText("00.A00.001 EMPRESA INDIVIDUAL SINTETICA")).length).toBeGreaterThan(0);
    expect(discoveryCalls("/discovery/establishments?")).toHaveLength(2);
    expect(discoveryCalls("/discovery/establishments?")[1][0].toString()).toBe(
      discoveryCalls("/discovery/establishments?")[0][0].toString(),
    );
  });
});
