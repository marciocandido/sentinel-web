import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { isSimilarCompanyPage } from "../../types/api";
import { discoveryPage, establishment, similarCompany, similarCompanyPage } from "../../test/fixtures";

const liveness = { status: "ok", service: "sentinel-api" } as const;
const catalog = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function isSimilar(input: RequestInfo | URL): boolean {
  return input.toString().includes("/similar?");
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/health/live")) return Promise.resolve(jsonResponse(liveness));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  if (isSimilar(input)) return Promise.resolve(jsonResponse(similarCompanyPage()));
  return Promise.resolve(jsonResponse(discoveryPage([
    establishment({ cnpj_full: "00AB/345600019X", cnpj_root: "00AB3456" }),
    establishment({ cnpj_full: "00111111000100", razao_social: "OUTRA REFERÊNCIA" }),
  ], { has_more: true })));
}

async function openDetails(index = 0) {
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "metal-mecanica" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  const triggers = await screen.findAllByRole("button", { name: "Ver detalhes" });
  triggers[index].focus();
  fireEvent.click(triggers[index]);
  return triggers;
}

async function openSimilar() {
  const triggers = await openDetails();
  fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
  return triggers;
}

function similarUrls(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => input.toString())
    .filter((url) => url.includes("/similar?"));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
  document.body.style.overflow = "";
});

describe("similar company contract guards", () => {
  it("accepts the complete contract without converting textual values", () => {
    const page = similarCompanyPage([similarCompany({
      reference_cnpj_root: "00AB3456",
      cnpj_full: "00CD345600019X",
      cnpj_root: "00CD3456",
      codigo_tom: "0012",
      codigo_ibge: "03550308",
      cnae_principal: "02511000",
      porte_codigo: "03",
      capital_social: "000500000.00",
    })]);
    expect(isSimilarCompanyPage(page)).toBe(true);
    expect(page.items[0]).toMatchObject({
      cnpj_full: "00CD345600019X",
      codigo_tom: "0012",
      codigo_ibge: "03550308",
      cnae_principal: "02511000",
      porte_codigo: "03",
      capital_social: "000500000.00",
    });
  });

  it.each([
    ["reference_cnpj_root non-string", { reference_cnpj_root: 123 }],
    ["cnpj_full non-string", { cnpj_full: 123 }],
    ["cnpj_root non-string", { cnpj_root: 123 }],
    ["nullable field invalid", { capital_social: 500 }],
    ["boolean coercible", { matched_same_segment: 1 }],
    ["rank zero", { similarity_rank: 0 }],
    ["rank six", { similarity_rank: 6 }],
    ["rank decimal", { similarity_rank: 2.5 }],
    ["reasons non-array", { similarity_reasons: "same_segment" }],
    ["unknown reason", { similarity_reasons: ["unknown"] }],
    ["negative distance", { distance_km: -0.1 }],
    ["NaN distance", { distance_km: Number.NaN }],
    ["infinite distance", { distance_km: Number.POSITIVE_INFINITY }],
    ["negative infinite distance", { distance_km: Number.NEGATIVE_INFINITY }],
    ["wrong status", { commercial_status: "CLIENT" }],
    ["wrong status source", { commercial_status_source: "erp" }],
  ])("rejects %s", (_label, overrides) => {
    expect(isSimilarCompanyPage(similarCompanyPage([
      similarCompany(overrides as Parameters<typeof similarCompany>[0]),
    ]))).toBe(false);
  });

  it("rejects invalid pagination", () => {
    expect(isSimilarCompanyPage({ ...similarCompanyPage(), pagination: { limit: 0, offset: 0, returned: 1, has_more: false } })).toBe(false);
  });
});

describe("similar companies drawer flow", () => {
  it("does not request similar companies on details open and requests the encoded textual CNPJ on demand", async () => {
    await openDetails();
    expect(similarUrls()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
    await screen.findByText("EMPRESA SEMELHANTE LTDA");
    expect(similarUrls()).toEqual([
      "/api/v1/discovery/establishments/00AB%2F345600019X/similar?limit=25&offset=0",
    ]);
  });

  it("shows loading, marks the named results region busy and prevents duplicate action calls", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (isSimilar(input)) return new Promise<Response>(() => undefined);
      return defaultApi(input);
    });
    await openDetails();
    const action = screen.getByRole("button", { name: "Ver semelhantes" });
    fireEvent.click(action);
    expect(screen.getByText("Consultando empresas semelhantes...")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Resultados de empresas semelhantes" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Ver semelhantes" })).not.toBeInTheDocument();
    expect(similarUrls()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Fechar detalhes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Voltar aos detalhes" })).toBeEnabled();
  });

  it("renders backend order, rank, ordered reasons, exact strings, nulls, distance and provisional status", async () => {
    const companies = [
      similarCompany({
        razao_social: "PRIMEIRA SEMELHANTE",
        cnpj_full: "00123456000100",
        cnpj_root: "00123456",
        similarity_rank: 2,
        similarity_reasons: ["same_uf", "same_segment"],
        matched_same_uf: false,
        matched_same_segment: false,
        capital_social: "000500000.00",
        distance_km: null,
      }),
      similarCompany({
        razao_social: "SEGUNDA SEMELHANTE",
        nome_fantasia: null,
        cnpj_full: "12AB345600019X",
        cnpj_root: "12AB3456",
        municipio_nome: null,
        uf: null,
        codigo_tom: null,
        codigo_ibge: null,
        cnae_principal: null,
        porte_codigo: null,
        capital_social: null,
        location_precision: null,
        similarity_rank: 5,
        similarity_reasons: ["within_radius"],
        distance_km: 12.345,
      }),
    ];
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSimilar(input)
      ? Promise.resolve(jsonResponse(similarCompanyPage(companies)))
      : defaultApi(input));
    await openSimilar();
    const resultsRegion = await screen.findByRole("region", { name: "Resultados de empresas semelhantes" });
    const list = resultsRegion.querySelector(".similar-list") as HTMLElement;
    const cards = Array.from(list.children) as HTMLElement[];
    expect(cards[0]).toHaveTextContent("PRIMEIRA SEMELHANTE");
    expect(cards[1]).toHaveTextContent("SEGUNDA SEMELHANTE");
    expect(cards[0]).toHaveTextContent("Rank 2");
    expect(cards[0]).toHaveTextContent("000500000.00");
    expect(cards[0]).not.toHaveTextContent(/Distância/);
    expect(cards[1]).toHaveTextContent("12,35 km");
    expect(cards[1]).toHaveTextContent("—");
    expect(cards[0].textContent?.indexOf("Mesma UF")).toBeLessThan(cards[0].textContent?.indexOf("Mesmo segmento") ?? 0);
    expect(cards[0]).toHaveTextContent("Mesma UF");
    expect(cards[0]).toHaveTextContent("Mesmo segmento");
    expect(within(resultsRegion).getAllByText("Desconhecido (provisório)")).toHaveLength(2);
    expect(screen.queryByText(/cliente|prospect|atendido|não atendido|probabilidade|score|% semelhante/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total geral|total de/i)).not.toBeInTheDocument();
  });

  it("treats an empty page as success and respects pagination controls and offsets", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSimilar(input)) return defaultApi(input);
      const url = new URL(input.toString(), "http://sentinel.local");
      const offset = Number(url.searchParams.get("offset"));
      if (offset === 25) return Promise.resolve(jsonResponse(similarCompanyPage([], { offset: 25, has_more: false })));
      return Promise.resolve(jsonResponse(similarCompanyPage([similarCompany()], { offset: 0, has_more: true })));
    });
    await openSimilar();
    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Nenhuma empresa semelhante foi encontrada.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(similarUrls()).toHaveLength(3));
    expect(similarUrls().map((url) => new URL(url, "http://sentinel.local").searchParams.get("offset"))).toEqual(["0", "25", "0"]);
  });

  it.each([
    ["reference_not_found", 404, "O estabelecimento de referência não foi encontrado."],
    ["invalid_request", 422, "Este estabelecimento não possui dados suficientes para comparação."],
    ["database_unavailable", 503, "A consulta de semelhantes não está disponível porque o banco do Sentinel está indisponível."],
    ["invalid_json", 200, "Resposta inválida da API. Tente novamente mais tarde."],
    ["network_error", 0, "Não foi possível consultar empresas semelhantes. Verifique a conexão e tente novamente."],
  ])("maps %s to a controlled public error", async (code, status, expected) => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSimilar(input)) return defaultApi(input);
      if (code === "network_error") return Promise.reject(new TypeError("private network detail"));
      if (code === "invalid_json") return Promise.resolve({ ok: true, status, json: () => Promise.reject(new Error("private json detail")) } as Response);
      return Promise.resolve(jsonResponse({ error: { code, message: "private backend detail" } }, status));
    });
    await openSimilar();
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/private .* detail/)).not.toBeInTheDocument();
  });

  it("turns a malformed HTTP 200 payload into invalid_response and rejects malformed rank", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => isSimilar(input)
      ? Promise.resolve(jsonResponse(similarCompanyPage([similarCompany({ similarity_rank: 0 })])))
      : defaultApi(input));
    await openSimilar();
    expect(await screen.findByText("Resposta inválida da API. Tente novamente mais tarde.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma empresa semelhante foi encontrada.")).not.toBeInTheDocument();
  });

  it("retries the exact CNPJ, limit and failed page offset", async () => {
    let offset25Attempts = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!isSimilar(input)) return defaultApi(input);
      const url = new URL(input.toString(), "http://sentinel.local");
      if (url.searchParams.get("offset") === "25") {
        offset25Attempts += 1;
        return offset25Attempts === 1
          ? Promise.reject(new TypeError("network"))
          : Promise.resolve(jsonResponse(similarCompanyPage([], { offset: 25 })));
      }
      return Promise.resolve(jsonResponse(similarCompanyPage([similarCompany()], { has_more: true })));
    });
    await openSimilar();
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Nenhuma empresa semelhante foi encontrada.");
    expect(similarUrls().slice(1)).toEqual([
      "/api/v1/discovery/establishments/00AB%2F345600019X/similar?limit=25&offset=25",
      "/api/v1/discovery/establishments/00AB%2F345600019X/similar?limit=25&offset=25",
    ]);
  });

  it("aborts on back, restarts at offset zero and keeps the same dialog open", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSimilar(input)) return defaultApi(input);
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    await openSimilar();
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos detalhes" }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Detalhes do estabelecimento");
    fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
    expect(similarUrls().map((url) => new URL(url, "http://sentinel.local").searchParams.get("offset"))).toEqual(["0", "0"]);
  });

  it("aborts on close and does not expose request_aborted", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSimilar(input)) return defaultApi(input);
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const triggers = await openSimilar();
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/cancelad/i)).not.toBeInTheDocument();
    expect(triggers[0]).toHaveFocus();
  });

  it("aborts before pagination and ignores an obsolete response", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(response: Response) => void> = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSimilar(input)) return defaultApi(input);
      signals.push(init?.signal as AbortSignal);
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    await openSimilar();
    await act(async () => resolvers[0](jsonResponse(similarCompanyPage([similarCompany({ razao_social: "PÁGINA ZERO" })], { has_more: true }))));
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos detalhes" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
    expect(signals[1].aborted).toBe(true);
    await act(async () => resolvers[2](jsonResponse(similarCompanyPage([similarCompany({ razao_social: "PÁGINA NOVA" })]))));
    expect(await screen.findByText("PÁGINA NOVA")).toBeInTheDocument();
    await act(async () => resolvers[1](jsonResponse(similarCompanyPage([similarCompany({ razao_social: "RESPOSTA OBSOLETA" })], { offset: 25 }))));
    expect(screen.queryByText("RESPOSTA OBSOLETA")).not.toBeInTheDocument();
  });

  it("maps timeout without exposing the internal abort", async () => {
    await openDetails();
    vi.useFakeTimers();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSimilar(input)) return defaultApi(input);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("internal abort", "AbortError")));
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getByText("A consulta excedeu o tempo limite. Tente novamente.")).toBeInTheDocument();
    expect(screen.queryByText(/internal abort|cancelad/i)).not.toBeInTheDocument();
  });

  it("switching the selected establishment aborts and resets the drawer to details", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSimilar(input)) return defaultApi(input);
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const triggers = await openSimilar();
    fireEvent.click(triggers[1]);
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Detalhes do estabelecimento");
    expect(within(screen.getByRole("dialog")).getByText("OUTRA REFERÊNCIA")).toBeInTheDocument();
  });

  it("keeps copy, Escape, one dialog and the allowed endpoint surface", async () => {
    await openSimilar();
    expect(await screen.findAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Copiar CNPJ" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("00AB/345600019X"));
    const urls = fetchMock.mock.calls.map(([input]) => input.toString());
    expect(urls.some((url) => /count|radius|feedback/i.test(url))).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
