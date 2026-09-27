import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedTestApp as App } from "../../test/AuthenticatedTestApp";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { discoveryPage, establishment } from "../../test/fixtures";
import {
  chooseFamily,
  clickSearch,
  discoveryUrls,
  openMoreFilters,
  searchButton,
  stubViewport,
} from "../../test/discoveryUi";

vi.mock("./RadiusMap", () => ({
  RadiusMap: () => <div role="img" aria-label="Mapa" />,
}));

const runtime = runtimeStatus();
const catalog = {
  items: [
    { id: "metal-mecanica", name: "Metal-mecânica" },
    { id: "tecnologia", name: "Tecnologia" },
  ],
};
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function isSearch(input: RequestInfo | URL) {
  return input.toString().startsWith("/api/v1/discovery/establishments?");
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/api/v1/runtime/status")) return Promise.resolve(jsonResponse(runtime));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  const parsed = new URL(url, "http://sentinel.local");
  const limit = Number(parsed.searchParams.get("limit"));
  const offset = Number(parsed.searchParams.get("offset"));
  return Promise.resolve(jsonResponse(discoveryPage([establishment()], { limit, offset })));
}

function searchUrls(): string[] {
  return discoveryUrls(fetchMock).filter((url) => url.startsWith("/api/v1/discovery/establishments?"));
}

function params(index: number): Record<string, string> {
  return Object.fromEntries(new URL(searchUrls()[index], "http://sentinel.local").searchParams);
}

async function selectSegment(value = "metal-mecanica") {
  fireEvent.change(await screen.findByLabelText(/^Segmento/), { target: { value } });
}

async function submitSegment() {
  await selectSegment();
  clickSearch();
}

type FilterInput = Partial<Record<"segment" | "uf" | "municipio" | "ibge" | "porte" | "capitalMin" | "capitalMax", string>>;

const uf = () => screen.getByLabelText(/^UF/);
const results = () => screen.getByRole("region", { name: "Resultados" });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Família Filtros — FILTERED", () => {
  it("starts in Filtros and requires at least one material filter, without the old segment rule", async () => {
    render(<App />);
    expect(await screen.findByRole("radio", { name: "Filtros" })).toBeChecked();
    clickSearch();
    const error = await screen.findByText(/Informe ao menos um filtro/);
    expect(screen.getByLabelText(/^Segmento/)).toHaveAccessibleDescription(error.textContent ?? "");
    expect(screen.queryByText(/Selecione um segmento para/)).not.toBeInTheDocument();
    expect(searchUrls()).toHaveLength(0);

    openMoreFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar descartados" }));
    clickSearch();
    expect(screen.getByText(/Informe ao menos um filtro/)).toBeInTheDocument();
    expect(searchUrls()).toHaveLength(0);
  });

  it("blocks invalid decimals and a capital minimum greater than maximum, revealing Mais filtros", async () => {
    render(<App />);
    await selectSegment();
    openMoreFilters();
    fireEvent.change(screen.getByLabelText(/^Capital mínimo/), { target: { value: "10,50" } });
    fireEvent.click(screen.getByRole("button", { name: /^Mais filtros/ }));
    clickSearch();
    expect(screen.getByRole("button", { name: /^Mais filtros/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/^Capital mínimo/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/valor decimal válido/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Capital mínimo/), { target: { value: "200.00" } });
    fireEvent.change(screen.getByLabelText(/^Capital máximo/), { target: { value: "100.00" } });
    clickSearch();
    expect(screen.getByText(/capital máximo deve ser maior/)).toBeInTheDocument();
    expect(searchUrls()).toHaveLength(0);
  });

  it.each([
    ["only segment", { segment: "metal-mecanica" }, { segment_id: "metal-mecanica" }],
    ["only UF", { uf: "SP" }, { uf: "SP" }],
    ["only porte", { porte: "03" }, { porte_codigo: "03" }],
    ["only capital minimum", { capitalMin: "100000" }, { capital_min: "100000" }],
    ["municipality and porte", { municipio: "DIADEMA", porte: "05" }, { municipio_nome: "DIADEMA", porte_codigo: "05" }],
    ["segment, municipality and capital", { segment: "metal-mecanica", municipio: "CAMPINAS", capitalMax: "900.50" }, { segment_id: "metal-mecanica", municipio_nome: "CAMPINAS", capital_max: "900.50" }],
    ["IBGE, segment and porte", { segment: "tecnologia", ibge: "0355030", porte: "01" }, { segment_id: "tecnologia", codigo_ibge: "0355030", porte_codigo: "01" }],
  ] as Array<[string, FilterInput, Record<string, string>]>)("sends %s to the canonical FILTERED route with AND semantics", async (_name, input, expected) => {
    render(<App />);
    await screen.findByLabelText(/^Segmento/);
    if (input.segment) await selectSegment(input.segment);
    if (input.uf) fireEvent.change(uf(), { target: { value: input.uf } });
    if (input.municipio) fireEvent.change(screen.getByLabelText(/^Município/), { target: { value: input.municipio } });
    openMoreFilters();
    if (input.ibge) fireEvent.change(screen.getByLabelText(/^Código IBGE/), { target: { value: input.ibge } });
    if (input.porte) fireEvent.change(screen.getByLabelText(/^Porte/), { target: { value: input.porte } });
    if (input.capitalMin) fireEvent.change(screen.getByLabelText(/^Capital mínimo/), { target: { value: input.capitalMin } });
    if (input.capitalMax) fireEvent.change(screen.getByLabelText(/^Capital máximo/), { target: { value: input.capitalMax } });
    clickSearch();
    await screen.findByRole("table", { name: /Empresas encontradas/ });
    expect(discoveryUrls(fetchMock)).toHaveLength(1);
    expect(params(0)).toEqual({ limit: "50", offset: "0", ...expected });
  });

  it("sends all eight filters as trimmed text, preserving leading zeros, plus include_discarded", async () => {
    render(<App />);
    await selectSegment();
    fireEvent.change(uf(), { target: { value: "SP" } });
    fireEvent.change(screen.getByLabelText(/^Município/), { target: { value: " SÃO PAULO " } });
    openMoreFilters();
    fireEvent.change(screen.getByLabelText(/^Código TOM/), { target: { value: "0012" } });
    fireEvent.change(screen.getByLabelText(/^Código IBGE/), { target: { value: "03550308" } });
    fireEvent.change(screen.getByLabelText(/^Porte/), { target: { value: "03" } });
    fireEvent.change(screen.getByLabelText(/^Capital mínimo/), { target: { value: "000100.50" } });
    fireEvent.change(screen.getByLabelText(/^Capital máximo/), { target: { value: "900.00" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar descartados" }));
    clickSearch();
    await screen.findByRole("table");
    expect(new URL(searchUrls()[0], "http://sentinel.local").pathname).toBe("/api/v1/discovery/establishments");
    expect(params(0)).toEqual({
      limit: "50",
      offset: "0",
      segment_id: "metal-mecanica",
      uf: "SP",
      municipio_nome: "SÃO PAULO",
      codigo_tom: "0012",
      codigo_ibge: "03550308",
      porte_codigo: "03",
      capital_min: "000100.50",
      capital_max: "900.00",
      include_discarded: "true",
    });
  });

  it("never calls the legacy segment/region routes for new Filtros searches", async () => {
    render(<App />);
    await submitSegment();
    await screen.findByRole("table");
    fireEvent.change(uf(), { target: { value: "SP" } });
    clickSearch();
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    const urls = fetchMock.mock.calls.map(([input]) => input.toString());
    expect(urls.every((url) =>
      url === "/api/v1/runtime/status" ||
      url === "/api/v1/catalog/segments" ||
      url.startsWith("/api/v1/discovery/establishments?"),
    )).toBe(true);
    expect(urls.some((url) => /\/segments\/|\/regions\/|count|radius|similar/i.test(url))).toBe(false);
  });

  it("disables the search button and marks results busy while loading, with a receipt", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSearch(input)) return defaultApi(input);
      return new Promise<Response>(() => undefined);
    });
    render(<App />);
    await submitSegment();
    expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buscando..." })).toHaveAttribute("aria-busy", "true");
    expect(results()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Buscando empresas...")).toBeInTheDocument();
    expect(within(results()).getByText(/Consulta submetida às \d{2}:\d{2}/)).toBeInTheDocument();
    expect(within(results()).getByRole("list", { name: "Critérios da consulta submetida" })).toHaveTextContent("Segmento: Metal-mecânica");
  });

  it("aborts an in-flight search on family change, never searches, keeps the receipt and retries the same query", async () => {
    let signal: AbortSignal | undefined;
    let pending = true;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSearch(input)) return defaultApi(input);
      signal = init?.signal ?? undefined;
      return pending ? new Promise<Response>(() => undefined) : defaultApi(input);
    });
    render(<App />);
    await submitSegment();
    await chooseFamily("Proximidade");
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText(/Busca cancelada ao trocar o tipo de busca/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(results()).getByText("Filtros", { selector: ".kind-badge" })).toBeInTheDocument();
    expect(screen.getByText(/Estes resultados são de Filtros. Trocar o tipo de busca não faz uma nova busca./)).toBeInTheDocument();
    expect(searchUrls()).toHaveLength(1);

    pending = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table");
    expect(searchUrls()).toHaveLength(2);
    expect(params(1)).toEqual(params(0));
  });

  it("preserves the last submitted result while another family draft is edited", async () => {
    render(<App />);
    await submitSegment();
    await screen.findByRole("table");
    await chooseFamily("Estrutura");
    fireEvent.change(screen.getByRole("textbox", { name: "CNPJ completo" }), { target: { value: "00ABC234000155" } });
    expect(screen.getByRole("table", { name: /Empresas encontradas/ })).toBeInTheDocument();
    expect(screen.queryByText("Formulário alterado.")).not.toBeInTheDocument();
    await chooseFamily("Filtros");
    expect(screen.getByLabelText(/^Segmento/)).toHaveValue("metal-mecanica");
    await chooseFamily("Estrutura");
    expect(screen.getByRole("textbox", { name: "CNPJ completo" })).toHaveValue("00ABC234000155");
    expect(searchUrls()).toHaveLength(1);
  });

  it("cancels the previous request and ignores its obsolete response", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSearch(input)) return defaultApi(input);
      signals.push(init?.signal as AbortSignal);
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    render(<App />);
    await selectSegment();
    fireEvent.change(uf(), { target: { value: "SP" } });
    fireEvent.submit(screen.getByRole("form", { name: "Critérios da busca" }));
    fireEvent.change(uf(), { target: { value: "RJ" } });
    fireEvent.submit(screen.getByRole("form", { name: "Critérios da busca" }));
    expect(signals[0].aborted).toBe(true);
    await act(async () => resolvers[1](jsonResponse(discoveryPage([establishment({ razao_social: "RESULTADO NOVO" })]))));
    expect(await screen.findByText("RESULTADO NOVO")).toBeInTheDocument();
    await act(async () => resolvers[0](jsonResponse(discoveryPage([establishment({ razao_social: "RESULTADO ANTIGO" })]))));
    expect(screen.queryByText("RESULTADO ANTIGO")).not.toBeInTheDocument();
    expect(screen.getByText("RESULTADO NOVO")).toBeInTheDocument();
  });

  it("cancels an in-flight search on unmount without showing an error", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSearch(input)) return defaultApi(input);
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { unmount } = render(<App />);
    await submitSegment();
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("uses correct next and previous offsets and disables unavailable directions", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSearch(input)) return defaultApi(input);
      const url = new URL(input.toString(), "http://sentinel.local");
      const offset = Number(url.searchParams.get("offset"));
      return Promise.resolve(jsonResponse(discoveryPage([establishment()], { offset, has_more: offset === 0 })));
    });
    render(<App />);
    await submitSegment();
    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText(/Página 2/);
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText(/Página 1/);
    expect(searchUrls().map((_, index) => params(index).offset)).toEqual(["0", "50", "0"]);
  });

  it("renders the compact commercial table: API order, text identifiers, CNAE match and provisional status", async () => {
    const items = [
      establishment({ razao_social: "PRIMEIRA LTDA", nome_fantasia: "Primeira", cnpj_full: "00123456000195", cnae_principal: "02511000", codigo_ibge: "03550308", capital_social: "0480000.00", porte_codigo: "03" }),
      establishment({ razao_social: "SEGUNDA", nome_fantasia: null, cnpj_full: "12AB345600019X", matched_by_cnae_principal: false, matched_by_cnae_secundario: true }),
      establishment({ razao_social: null, nome_fantasia: null, cnpj_full: "003", matched_by_cnae_principal: true, matched_by_cnae_secundario: true, municipio_nome: null, uf: null, cnae_principal: null, porte_codigo: null, capital_social: null, location_precision: null }),
    ];
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSearch(input)
      ? Promise.resolve(jsonResponse(discoveryPage(items)))
      : defaultApi(input));
    render(<App />);
    await submitSegment();
    const table = await screen.findByRole("table", { name: /Empresas encontradas/ });
    expect(table).toHaveClass("results-table--sticky");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Empresa", "Localização", "Atividade (CNAE)", "Porte e capital", "Status comercial", "Ações",
    ]);
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Primeira");
    expect(rows[1]).toHaveTextContent("PRIMEIRA LTDA");
    expect(rows[1]).toHaveTextContent("IBGE 03550308");
    expect(rows[1]).toHaveTextContent("R$ 480.000,00");
    expect(rows[1]).toHaveTextContent("Porte 03");
    expect(rows[2]).toHaveTextContent("SEGUNDA");
    expect(rows[2]).toHaveTextContent("Sem nome fantasia");
    expect(within(table).getByText("00123456000195")).toBeInTheDocument();
    expect(within(table).getByText("12AB345600019X")).toBeInTheDocument();
    expect(within(table).getByText("02511000")).toBeInTheDocument();
    expect(within(rows[1]).getByText("CNAE principal")).toBeInTheDocument();
    expect(within(rows[2]).getByText("via CNAE secundário")).toBeInTheDocument();
    expect(within(rows[3]).getByText("principal e secundário")).toBeInTheDocument();
    expect(within(table).getAllByText("Desconhecido")).toHaveLength(3);
    expect(within(table).getAllByText("sem ERP")).toHaveLength(3);
    expect(within(table).getByRole("button", { name: "Detalhes de PRIMEIRA LTDA" })).toBeInTheDocument();
    expect(screen.queryByText(/cliente|prospect/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });

  it("presents an empty result as a valid state", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSearch(input)
      ? Promise.resolve(jsonResponse(discoveryPage([])))
      : defaultApi(input));
    render(<App />);
    await submitSegment();
    expect(await screen.findByText(/Nenhuma empresa encontrada/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["database_unavailable", 503, /banco do Sentinel está indisponível/],
    ["invalid_request", 422, /API rejeitou os filtros/],
  ])("shows a public %s error", async (code, status, expected) => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSearch(input)
      ? Promise.resolve(jsonResponse({ error: { code, message: "internal details" } }, status))
      : defaultApi(input));
    render(<App />);
    await submitSegment();
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText("internal details")).not.toBeInTheDocument();
  });

  it("handles a network failure and retries the exact submitted snapshot", async () => {
    let attempts = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSearch(input)) return defaultApi(input);
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new TypeError("network details"))
        : Promise.resolve(jsonResponse(discoveryPage()));
    });
    render(<App />);
    await selectSegment();
    fireEvent.change(uf(), { target: { value: "SP" } });
    clickSearch();
    expect(await screen.findByText(/Não foi possível concluir/)).toBeInTheDocument();
    fireEvent.change(uf(), { target: { value: "RJ" } });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table");
    expect(searchUrls()).toHaveLength(2);
    expect(params(1).uf).toBe("SP");
    expect(screen.queryByText("network details")).not.toBeInTheDocument();
  });

  it("handles timeout with a retry that repeats the submitted query", async () => {
    render(<App />);
    await selectSegment();
    vi.useFakeTimers();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSearch(input)) return defaultApi(input);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    clickSearch();
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getByRole("alert")).toHaveTextContent("A busca excedeu o tempo limite. Nada foi perdido: tentar de novo repete exatamente a consulta submetida.");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText(/cancelad/i)).not.toBeInTheDocument();
  });

  it("handles a malformed success response", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSearch(input)
      ? Promise.resolve(jsonResponse({ items: [{ cnpj_full: 123 }], pagination: {} }))
      : defaultApi(input));
    render(<App />);
    await submitSegment();
    expect(await screen.findByText(/Resposta inválida da API/)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma empresa encontrada/)).not.toBeInTheDocument();
  });
});

describe("Formulário editável × consulta submetida", () => {
  async function searchSpThenEditMg() {
    render(<App />);
    await selectSegment();
    fireEvent.change(uf(), { target: { value: "SP" } });
    clickSearch();
    await screen.findByRole("table");
    fireEvent.change(uf(), { target: { value: "MG" } });
  }

  it("marks the changed field, keeps results and receipt on SP and explains the pending change", async () => {
    await searchSpThenEditMg();
    expect(uf()).toHaveAccessibleDescription("Pesquisado: SP");
    expect(screen.getByText("alterado")).toBeInTheDocument();
    expect(screen.getByText("1 alteração não pesquisada")).toBeInTheDocument();
    const receipt = screen.getByRole("list", { name: "Critérios da consulta submetida" });
    expect(within(receipt).getByText(/UF:/).closest("li")).toHaveTextContent("UF: SP → MG não pesquisado");
    const notice = screen.getByText("Formulário alterado.").closest(".stale-notice") as HTMLElement;
    expect(notice).toHaveTextContent("UF: SP → MG. Os resultados abaixo continuam sendo de UF SP.");
    expect(notice).toHaveTextContent("Exportar, salvar pesquisa e criar lista também usam a consulta submetida.");
    expect(searchUrls()).toHaveLength(1);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("paginates, changes limit and exports with the submitted snapshot, not the draft", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === "/api/v1/discovery/exports") {
        return Promise.resolve({ ok: false, status: 422, json: () => Promise.resolve({ error: { code: "export_too_large", message: "x" } }) } as Response);
      }
      if (!isSearch(input)) return defaultApi(input);
      const offset = Number(new URL(url, "http://sentinel.local").searchParams.get("offset"));
      void init;
      return Promise.resolve(jsonResponse(discoveryPage([establishment()], { offset, has_more: offset === 0 })));
    });
    await searchSpThenEditMg();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    expect(params(1)).toMatchObject({ uf: "SP", offset: "50" });
    await screen.findByText(/Página 2/);
    fireEvent.change(screen.getByLabelText("Resultados por página"), { target: { value: "25" } });
    await waitFor(() => expect(searchUrls()).toHaveLength(3));
    expect(params(2)).toMatchObject({ uf: "SP", limit: "25", offset: "0" });
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await screen.findByText(/excede o limite de exportação/);
    const exportCall = fetchMock.mock.calls.find(([url]) => url === "/api/v1/discovery/exports") as [string, RequestInit];
    expect(JSON.parse(exportCall[1].body as string)).toEqual({
      format: "CSV",
      search: { kind: "FILTERED", segment_id: "metal-mecanica", uf: "SP" },
    });
  });

  it("saves the search and creates a worklist from the submitted snapshot", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === "/api/v1/discovery/worklists" && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse({ worklist_id: "3b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498", name: body.name, source_search: body.search, item_count: 1, created_at: "2026-08-17T12:00:00Z" }, 201));
      }
      if (url === "/api/v1/discovery/saved-searches" && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse({ saved_search_id: "2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498", name: body.name, search: body.search, created_at: "2026-08-17T12:00:00Z" }, 201));
      }
      return defaultApi(input);
    });
    await searchSpThenEditMg();
    const actions = screen.getByRole("group", { name: "Ações da consulta submetida" });
    expect(actions).toHaveAccessibleDescription("Ações usam a consulta submetida completa — não o formulário atual nem só esta página.");

    fireEvent.click(within(actions).getByRole("button", { name: "Salvar pesquisa" }));
    expect(screen.getByLabelText("Nome da pesquisa")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Nome da pesquisa"), { target: { value: "Metal SP" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Pesquisa salva.")).toBeInTheDocument();

    fireEvent.click(within(actions).getByRole("button", { name: "Criar lista de trabalho" }));
    fireEvent.change(screen.getByLabelText("Nome da lista de trabalho"), { target: { value: "Visitas" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Lista de trabalho salva.")).toBeInTheDocument();

    const bodies = fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
      .map(([url, init]) => [url, JSON.parse((init as RequestInit).body as string)]);
    expect(bodies).toEqual([
      ["/api/v1/discovery/saved-searches", { name: "Metal SP", search: { kind: "FILTERED", segment_id: "metal-mecanica", uf: "SP" } }],
      ["/api/v1/discovery/worklists", { name: "Visitas", search: { kind: "FILTERED", segment_id: "metal-mecanica", uf: "SP" } }],
    ]);
  });

  it("shows a public name conflict when saving", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (input.toString() === "/api/v1/discovery/saved-searches" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ error: { code: "saved_search_name_conflict", message: "private" } }, 409));
      }
      return defaultApi(input);
    });
    render(<App />);
    await submitSegment();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesquisa" }));
    fireEvent.change(screen.getByLabelText("Nome da pesquisa"), { target: { value: "Duplicada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma pesquisa com esse nome.");
    expect(screen.getByLabelText("Nome da pesquisa")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });

  it("Desfazer restores the draft to the submitted snapshot without searching", async () => {
    await searchSpThenEditMg();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer alterações" }));
    expect(uf()).toHaveValue("SP");
    expect(screen.queryByText("Formulário alterado.")).not.toBeInTheDocument();
    expect(screen.queryByText("alterado")).not.toBeInTheDocument();
    fireEvent.change(uf(), { target: { value: "MG" } });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(uf()).toHaveValue("SP");
    expect(searchUrls()).toHaveLength(1);
  });

  it("Buscar com alterações creates a new submitted snapshot and a new receipt", async () => {
    await searchSpThenEditMg();
    fireEvent.click(screen.getByRole("button", { name: "Buscar com alterações" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    expect(params(1)).toMatchObject({ uf: "MG", segment_id: "metal-mecanica", offset: "0" });
    await screen.findByRole("table");
    expect(screen.queryByText("Formulário alterado.")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Critérios da consulta submetida" })).toHaveTextContent("UF: MG");
  });

  it("applies the discarded toggle only to the next submitted snapshot and flags it as not searched", async () => {
    render(<App />);
    await submitSegment();
    await screen.findByRole("table");
    expect(screen.getByText(/descartados ocultos/)).toBeInTheDocument();
    openMoreFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar descartados" }));
    expect(screen.getByRole("checkbox", { name: "Mostrar descartados" })).toHaveAccessibleDescription(/Pesquisado: descartados ocultos/);
    expect(screen.getByText(/Descartados: ocultos → incluídos/)).toBeInTheDocument();
    expect(params(0)).not.toHaveProperty("include_discarded");
    clickSearch();
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    expect(params(1).include_discarded).toBe("true");
    expect(params(1)).not.toHaveProperty("actor_id");
    expect(await screen.findByText(/descartados incluídos/)).toBeInTheDocument();
  });

  it("closes an open save attempt after a new submission", async () => {
    render(<App />);
    await submitSegment();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesquisa" }));
    expect(screen.getByLabelText("Nome da pesquisa")).toBeInTheDocument();
    clickSearch();
    await waitFor(() => expect(screen.queryByLabelText("Nome da pesquisa")).not.toBeInTheDocument());
  });
});

describe("Compatibilidade de pesquisas salvas", () => {
  const savedPage = (search: Record<string, unknown>) => ({
    items: [{ saved_search_id: "2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498", name: "Antiga", search, created_at: "2026-08-13T12:00:00Z" }],
    pagination: { limit: 20, offset: 0, returned: 1, has_more: false },
  });

  it.each([
    ["SEGMENT", { kind: "SEGMENT", segment_id: "metal-mecanica", uf: "PR", codigo_tom: "0001", porte_codigo: "03", capital_min: "100.00", capital_max: null }, "Filtros · Segmento", { segment_id: "metal-mecanica", uf: "PR", codigo_tom: "0001", porte_codigo: "03", capital_min: "100.00" }],
    ["REGION", { kind: "REGION", uf: "PR", codigo_tom: null, codigo_ibge: "0410000", municipio_nome: "CURITIBA", segment_id: null, include_discarded: true }, "Filtros · Região", { uf: "PR", codigo_ibge: "0410000", municipio_nome: "CURITIBA", include_discarded: "true" }],
    ["FILTERED", { kind: "FILTERED", porte_codigo: "05", capital_max: "900" }, "Filtros", { porte_codigo: "05", capital_max: "900" }],
  ])("loads %s into Filtros without executing and the next Buscar sends FILTERED", async (_kind, search, label, expected) => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (input.toString().includes("/saved-searches")) return Promise.resolve(jsonResponse(savedPage(search)));
      return defaultApi(input);
    });
    render(<App />);
    await chooseFamily("Estrutura");
    fireEvent.click(screen.getByRole("button", { name: "Pesquisas salvas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Carregar critérios de Antiga" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Filtros" })).toBeChecked();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(`Critérios de “Antiga” (${label}) carregados.`);
    expect(discoveryUrls(fetchMock).filter((url) => !url.includes("/saved-searches"))).toHaveLength(0);

    clickSearch();
    await screen.findByRole("table");
    expect(searchUrls()).toHaveLength(1);
    expect(params(0)).toEqual({ limit: "50", offset: "0", ...expected });
    expect(fetchMock.mock.calls.some(([url, init]) => url.toString().includes("/saved-searches") && (init as RequestInit | undefined)?.method !== "GET")).toBe(false);
  });
});

describe("Mobile", () => {
  it("renders results as cards with explicit pagination and actions, never a giant table", async () => {
    stubViewport(true);
    render(<App />);
    await submitSegment();
    const cards = await screen.findByRole("list", { name: "Empresas encontradas pelos critérios submetidos" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const card = within(cards).getAllByRole("listitem")[0];
    expect(within(card).getByRole("heading", { name: "EXEMPLO" })).toBeInTheDocument();
    expect(card).toHaveTextContent("00123456000195");
    expect(card).toHaveTextContent("Local");
    expect(card).toHaveTextContent("CNAE");
    expect(card).toHaveTextContent("Porte");
    expect(card).toHaveTextContent("Desconhecido");
    expect(within(card).getByRole("button", { name: /^Detalhes de/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeInTheDocument();
    expect(searchButton().closest(".criteria-footer")).not.toBeNull();
  });

  it("opens the details drawer from a card and returns focus to it", async () => {
    stubViewport(true);
    render(<App />);
    await submitSegment();
    const details = await screen.findByRole("button", { name: /^Detalhes de/ });
    details.focus();
    fireEvent.click(details);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(details).toHaveFocus();
  });
});
