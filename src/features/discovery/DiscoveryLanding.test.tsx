import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { discoveryPage, establishment } from "../../test/fixtures";

const liveness = { status: "ok", service: "sentinel-api" } as const;
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
  return input.toString().includes("/api/v1/discovery/");
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/health/live")) return Promise.resolve(jsonResponse(liveness));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  const parsed = new URL(url, "http://sentinel.local");
  const limit = Number(parsed.searchParams.get("limit"));
  const offset = Number(parsed.searchParams.get("offset"));
  return Promise.resolve(jsonResponse(discoveryPage([establishment()], { limit, offset })));
}

function searchUrls(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => input.toString())
    .filter((url) => url.includes("/api/v1/discovery/"));
}

async function selectSegment(value = "metal-mecanica") {
  fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value } });
}

async function submitSegment() {
  await selectSegment();
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Discovery search", () => {
  it("starts in segment mode and validates the required segment", async () => {
    render(<App />);
    expect(screen.getByRole("radio", { name: "Por segmento" })).toBeChecked();
    expect(screen.getByText("Preencha os filtros e execute uma busca.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Selecione um segmento para realizar a busca.")).toBeInTheDocument();
    expect(searchUrls()).toHaveLength(0);
  });

  it("blocks invalid decimals and a capital minimum greater than maximum", async () => {
    render(<App />);
    await selectSegment();
    fireEvent.change(screen.getByLabelText("Capital mínimo"), { target: { value: "10,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByText(/valor decimal válido/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Capital mínimo"), { target: { value: "200.00" } });
    fireEvent.change(screen.getByLabelText("Capital máximo"), { target: { value: "100.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByText(/capital máximo deve ser maior/)).toBeInTheDocument();
    expect(searchUrls()).toHaveLength(0);
  });

  it("uses only the segment route with submitted filters and offset zero", async () => {
    render(<App />);
    await selectSegment();
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.change(screen.getByLabelText("Código TOM"), { target: { value: "0012" } });
    fireEvent.change(screen.getByLabelText("Porte"), { target: { value: "03" } });
    fireEvent.change(screen.getByLabelText("Capital mínimo"), { target: { value: "100.50" } });
    fireEvent.change(screen.getByLabelText("Capital máximo"), { target: { value: "900.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("table", { name: /Empresas encontradas/ });
    const url = new URL(searchUrls()[0], "http://sentinel.local");
    expect(url.pathname).toBe("/api/v1/discovery/segments/metal-mecanica/establishments");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "50",
      offset: "0",
      uf: "SP",
      codigo_tom: "0012",
      porte_codigo: "03",
      capital_min: "100.50",
      capital_max: "900.00",
    });
  });

  it("requires a regional filter and does not accept segment alone", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Por região" }));
    await selectSegment();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByText(/Informe ao menos UF/)).toBeInTheDocument();
    expect(searchUrls()).toHaveLength(0);
  });

  it("uses only the region route with UF, TOM, IBGE, municipality and optional segment", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Por região" }));
    await selectSegment();
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.change(screen.getByLabelText("Nome do município"), { target: { value: "SAO PAULO" } });
    fireEvent.change(screen.getByLabelText("Código TOM"), { target: { value: "0012" } });
    fireEvent.change(screen.getByLabelText("Código IBGE"), { target: { value: "03550308" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("table", { name: /Empresas encontradas/ });
    const url = new URL(searchUrls()[0], "http://sentinel.local");
    expect(url.pathname).toBe("/api/v1/discovery/regions/establishments");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "50",
      offset: "0",
      uf: "SP",
      codigo_tom: "0012",
      codigo_ibge: "03550308",
      municipio_nome: "SAO PAULO",
      segment_id: "metal-mecanica",
    });
  });

  it("disables the search button and marks results busy while loading", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSearch(input)) return defaultApi(input);
      return new Promise<Response>(() => undefined);
    });
    render(<App />);
    await submitSegment();
    expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Resultados" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Buscando empresas...")).toBeInTheDocument();
  });

  it("cancels a request on mode change, clears validation and does not search automatically", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSearch(input)) return defaultApi(input);
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText(/Selecione um segmento/)).toBeInTheDocument();
    await submitSegment();
    fireEvent.click(screen.getByRole("radio", { name: "Por região" }));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText(/Selecione um segmento para realizar/)).not.toBeInTheDocument();
    expect(screen.getByText("Preencha os filtros e execute uma busca.")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de busca" }));
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "RJ" } });
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de busca" }));
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

  it("uses the submitted snapshot for next page after form edits", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSearch(input)) return defaultApi(input);
      const url = new URL(input.toString(), "http://sentinel.local");
      const offset = Number(url.searchParams.get("offset"));
      return Promise.resolve(jsonResponse(discoveryPage([establishment()], { offset, has_more: offset === 0 })));
    });
    render(<App />);
    await selectSegment();
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "RJ" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    const nextUrl = new URL(searchUrls()[1], "http://sentinel.local");
    expect(nextUrl.searchParams.get("uf")).toBe("SP");
    expect(nextUrl.searchParams.get("offset")).toBe("50");
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
    const nextButton = screen.getByRole("button", { name: "Próxima" });
    expect(nextButton).toBeEnabled();
    fireEvent.click(nextButton);
    await screen.findByText(/Página 2/);
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText(/Página 1/);
    const offsets = searchUrls().map((url) => new URL(url, "http://sentinel.local").searchParams.get("offset"));
    expect(offsets).toEqual(["0", "50", "0"]);
  });

  it("changes limit using the submitted snapshot and restarts from offset zero", async () => {
    render(<App />);
    await selectSegment();
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "RJ" } });
    fireEvent.change(screen.getByLabelText("Resultados por página"), { target: { value: "25" } });
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    const url = new URL(searchUrls()[1], "http://sentinel.local");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("uf")).toBe("SP");
  });

  it("renders strings, nulls, match labels, UNKNOWN and backend order without inventing a total", async () => {
    const items = [
      establishment({ razao_social: "PRIMEIRA", cnpj_full: "00123456000195", cnae_principal: "02511000", codigo_tom: "0012", codigo_ibge: "03550308" }),
      establishment({ razao_social: "SEGUNDA", cnpj_full: "12AB345600019X", matched_by_cnae_principal: false, matched_by_cnae_secundario: true }),
      establishment({ razao_social: null, nome_fantasia: null, cnpj_full: "003", matched_by_cnae_principal: true, matched_by_cnae_secundario: true, municipio_nome: null, uf: null, cnae_principal: null, porte_codigo: null, capital_social: null, location_precision: null }),
    ];
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSearch(input)
      ? Promise.resolve(jsonResponse(discoveryPage(items)))
      : defaultApi(input));
    render(<App />);
    await submitSegment();
    const rows = await screen.findAllByRole("row");
    expect(rows[1]).toHaveTextContent("PRIMEIRA");
    expect(rows[2]).toHaveTextContent("SEGUNDA");
    expect(screen.getByText("00123456000195")).toBeInTheDocument();
    expect(screen.getByText("12AB345600019X")).toBeInTheDocument();
    expect(screen.getByText("02511000")).toBeInTheDocument();
    expect(screen.getAllByText("CNAE principal").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("CNAE secundário")).toBeInTheDocument();
    expect(screen.getByText("Principal e secundário")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Desconhecido (provisório)")).toHaveLength(3);
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
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText(/Não foi possível concluir/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "RJ" } });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table");
    expect(searchUrls()).toHaveLength(2);
    expect(new URL(searchUrls()[1], "http://sentinel.local").searchParams.get("uf")).toBe("SP");
    expect(screen.queryByText("network details")).not.toBeInTheDocument();
  });

  it("handles timeout without exposing cancellation as an error", async () => {
    render(<App />);
    await selectSegment();
    vi.useFakeTimers();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSearch(input)) return defaultApi(input);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getByText(/busca excedeu o tempo limite/)).toBeInTheDocument();
    expect(screen.queryByText(/cancelad/i)).not.toBeInTheDocument();
  });

  it("handles a malformed success response", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSearch(input)
      ? Promise.resolve(jsonResponse({ items: [{ cnpj_full: 123 }], pagination: {} }))
      : defaultApi(input));
    render(<App />);
    await submitSegment();
    expect(await screen.findByText(/Resposta inválida da API/)).toBeInTheDocument();
  });

  it("never calls an endpoint outside the allowed liveness, catalog, segment and region routes", async () => {
    render(<App />);
    await submitSegment();
    fireEvent.click(screen.getByRole("radio", { name: "Por região" }));
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SP" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    const urls = fetchMock.mock.calls.map(([input]) => input.toString());
    expect(urls.every((url) =>
      url === "/health/live" ||
      url === "/api/v1/catalog/segments" ||
      url.startsWith("/api/v1/discovery/segments/") ||
      url.startsWith("/api/v1/discovery/regions/establishments"),
    )).toBe(true);
    expect(urls.some((url) => /count|ready|radius|similar/i.test(url))).toBe(false);
  });
});
