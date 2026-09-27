import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedTestApp as App } from "../../test/AuthenticatedTestApp";
import {
  commercialGroupPage,
  discoveryPage,
  neighborSearchPage,
  radiusSearchPage,
  rootBranchesPage,
} from "../../test/fixtures";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { chooseProximity, chooseRadiusOrigin, clickSearch, discoveryUrls } from "../../test/discoveryUi";

vi.mock("./RadiusMap", () => ({
  RadiusMap: ({ accessibleName }: { accessibleName?: string }) => <div role="img" aria-label={accessibleName ?? "Mapa"} />,
}));

const fetchMock = vi.fn();
let savedSearch: Record<string, unknown> = {};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

function api(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/runtime/status")) return Promise.resolve(jsonResponse(runtimeStatus()));
  if (url.includes("/catalog/segments")) return Promise.resolve(jsonResponse({ items: [{ id: "metal", name: "Metal-mecânica" }] }));
  if (url.includes("/saved-searches")) {
    return Promise.resolve(jsonResponse({
      items: [{ saved_search_id: "2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498", name: "Salva", search: savedSearch, created_at: "2026-08-13T12:00:00Z" }],
      pagination: { limit: 20, offset: 0, returned: 1, has_more: false },
    }));
  }
  if (url.includes("/radius/establishments")) return Promise.resolve(jsonResponse(radiusSearchPage()));
  if (url.includes("/neighbors")) return Promise.resolve(jsonResponse(neighborSearchPage()));
  if (url.includes("/root-branches")) return Promise.resolve(jsonResponse(rootBranchesPage()));
  if (url.includes("/commercial-groups")) return Promise.resolve(jsonResponse(commercialGroupPage()));
  return Promise.resolve(jsonResponse(discoveryPage()));
}

const searchCalls = () => discoveryUrls(fetchMock).filter((url) => !url.includes("/saved-searches"));

async function loadSaved(search: Record<string, unknown>) {
  savedSearch = search;
  render(<App />);
  await screen.findByLabelText(/^Segmento/);
  fireEvent.click(screen.getByRole("button", { name: "Pesquisas salvas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Carregar critérios de Salva" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(api);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("Pesquisas salvas por família", () => {
  it("loads RADIUS into Proximidade · Raio without executing, preserving textual origin", async () => {
    await loadSaved({ kind: "RADIUS", radius_km: 15, origin_cnpj: "00ABC234000155", segment_id: "metal", uf: "SP" });
    expect(screen.getByRole("radio", { name: "Proximidade" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Raio a partir de uma origem" })).toBeChecked();
    expect(within(screen.getByRole("radiogroup", { name: "Origem" })).getByRole("radio", { name: "CNPJ" })).toBeChecked();
    expect(screen.getByLabelText("CNPJ de origem")).toHaveValue("00ABC234000155");
    expect(screen.getByLabelText("Raio (km)")).toHaveValue("15");
    expect(screen.getByLabelText("UF dos resultados (opcional)")).toHaveValue("SP");
    expect(searchCalls()).toHaveLength(0);
    clickSearch();
    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    expect(searchCalls()[0]).toContain("/api/v1/discovery/radius/establishments?");
    expect(searchCalls()[0]).toContain("origin_cnpj=00ABC234000155");
  });

  it("loads NEIGHBORS into Proximidade · Vizinhos and keeps its distinct contract", async () => {
    await loadSaved({ kind: "NEIGHBORS", cnpj_full: "00ABC234000155", radius_km: 10, segment_id: null, uf: null });
    expect(screen.getByRole("radio", { name: "Vizinhos de um CNPJ" })).toBeChecked();
    expect(screen.getByLabelText("CNPJ de referência")).toHaveValue("00ABC234000155");
    expect(searchCalls()).toHaveLength(0);
    clickSearch();
    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    expect(searchCalls()[0]).toMatch(/^\/api\/v1\/discovery\/establishments\/00ABC234000155\/neighbors\?/);
    expect(await screen.findByText("Proximidade · Vizinhos", { selector: ".kind-badge" })).toBeInTheDocument();
  });

  it("loads ROOT_BRANCHES by root into Estrutura · Raiz e filiais", async () => {
    await loadSaved({ kind: "ROOT_BRANCHES", cnpj: null, cnpj_root: "00AB3456" });
    expect(screen.getByRole("radio", { name: "Estrutura" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Raiz e filiais" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Raiz do CNPJ" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Raiz do CNPJ" })).toHaveValue("00AB3456");
    expect(searchCalls()).toHaveLength(0);
    clickSearch();
    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    expect(searchCalls()[0]).toContain("/api/v1/discovery/root-branches?");
    expect(searchCalls()[0]).toContain("cnpj_root=00AB3456");
  });

  it("loads COMMERCIAL_GROUP into Estrutura · Grupo comercial registrado", async () => {
    await loadSaved({ kind: "COMMERCIAL_GROUP", group_id: "GRP-0042", include_discarded: true });
    expect(screen.getByRole("radio", { name: "Grupo comercial registrado" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "ID do grupo registrado" })).toHaveValue("GRP-0042");
    expect(screen.getByRole("button", { name: /^Mais filtros/ })).toHaveTextContent("1 ativo");
    clickSearch();
    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    expect(searchCalls()[0]).toContain("group_id=GRP-0042");
    expect(searchCalls()[0]).toContain("include_discarded=true");
  });
});

describe("Proximidade × consulta submetida", () => {
  it("keeps radius results on the submitted radius, marks the change and restores it with Desfazer", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => input.toString().includes("/radius/establishments")
      ? Promise.resolve(jsonResponse(radiusSearchPage(undefined, { has_more: true })))
      : api(input));
    render(<App />);
    await chooseProximity("Raio a partir de uma origem");
    chooseRadiusOrigin("CNPJ");
    fireEvent.change(screen.getByLabelText("CNPJ de origem"), { target: { value: "00ABC234000155" } });
    fireEvent.change(screen.getByLabelText("Raio (km)"), { target: { value: "10" } });
    clickSearch();
    await screen.findByLabelText("Origem resolvida");
    expect(screen.getByRole("list", { name: "Critérios da consulta submetida" })).toHaveTextContent("Origem: CNPJ 00ABC234000155");

    fireEvent.change(screen.getByLabelText("Raio (km)"), { target: { value: "25" } });
    expect(screen.getByLabelText("Raio (km)")).toHaveAccessibleDescription("Pesquisado: 10 km");
    expect(screen.getByText("Formulário alterado.").closest(".stale-notice")).toHaveTextContent("Raio: 10 km → 25 km");
    expect(screen.getByRole("list", { name: "Critérios da consulta submetida" })).toHaveTextContent("Raio: 10 km → 25 km não pesquisado");

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(searchCalls()).toHaveLength(2));
    expect(new URL(searchCalls()[1], "http://local").searchParams.get("radius_km")).toBe("10");

    fireEvent.click(await screen.findByRole("button", { name: "Desfazer alterações" }));
    expect(screen.getByLabelText("Raio (km)")).toHaveValue("10");
    expect(screen.queryByText("Formulário alterado.")).not.toBeInTheDocument();
  });

  it("does not collapse radius-by-CNPJ and neighbors into one contract", async () => {
    render(<App />);
    await chooseProximity("Raio a partir de uma origem");
    chooseRadiusOrigin("CNPJ");
    fireEvent.change(screen.getByLabelText("CNPJ de origem"), { target: { value: "00ABC234000155" } });
    fireEvent.change(screen.getByLabelText("Raio (km)"), { target: { value: "10" } });
    clickSearch();
    await screen.findByLabelText("Origem resolvida");
    await chooseProximity("Vizinhos de um CNPJ");
    fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "00ABC234000155" } });
    fireEvent.change(screen.getByLabelText("Raio (km)"), { target: { value: "10" } });
    expect(screen.queryByText("Formulário alterado.")).not.toBeInTheDocument();
    expect(screen.getByText(/Estes resultados são de Proximidade · Raio/)).toBeInTheDocument();
    clickSearch();
    await waitFor(() => expect(searchCalls()).toHaveLength(2));
    expect(searchCalls()[0]).toContain("/radius/establishments?");
    expect(searchCalls()[1]).toContain("/establishments/00ABC234000155/neighbors?");
    expect(await screen.findByLabelText("Origem resolvida")).toHaveTextContent("Vizinhos sempre excluem a própria origem.");
  });
});
