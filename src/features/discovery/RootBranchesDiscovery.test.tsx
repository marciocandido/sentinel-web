import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import {
  discoveryPage,
  establishment,
  radiusSearchPage,
  rootBranchEstablishment,
  rootBranchesContext,
  rootBranchesPage,
  similarCompanyPage,
} from "../../test/fixtures";
import { isRootBranchesPage } from "../../types/api";
import { EMPTY_ROOT_BRANCHES_FORM } from "./rootBranchesTypes";
import {
  createRootBranchesSnapshot,
  publicRootBranchesError,
  validateRootBranches,
} from "./rootBranchesUtils";

vi.mock("./RadiusMap", () => ({
  RadiusMap: () => (
    <div role="region" aria-label="Mapa da busca por raio">
      Mapa complementar
    </div>
  ),
}));

const fetchMock = vi.fn();
const liveness = { status: "ok", service: "sentinel-api" } as const;
const catalog = { items: [{ id: "metal", name: "Metal" }] };

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/health/live")) return Promise.resolve(response(liveness));
  if (url.includes("/catalog/segments")) return Promise.resolve(response(catalog));
  if (url.includes("/root-branches?")) {
    return Promise.resolve(response(rootBranchesPage()));
  }
  if (url.includes("/radius/establishments?")) {
    return Promise.resolve(response(radiusSearchPage()));
  }
  if (url.includes("/similar?")) {
    return Promise.resolve(response(similarCompanyPage()));
  }
  return Promise.resolve(
    response(
      discoveryPage([
        establishment({
          cnpj_full: "00AB345600019X",
          cnpj_root: "00AB3456",
          razao_social: "REFERÊNCIA DO DRAWER",
        }),
      ]),
    ),
  );
}

function rootCalls() {
  return fetchMock.mock.calls.filter(([input]) =>
    input.toString().includes("/root-branches?"),
  );
}

function rootUrl(index: number): URL {
  return new URL(rootCalls()[index][0].toString(), "http://local");
}

function selectRootMode() {
  fireEvent.click(screen.getByRole("radio", { name: "Por raiz/filiais" }));
}

function identifierInput(name: "CNPJ completo" | "Raiz do CNPJ") {
  return screen.getByRole("textbox", { name });
}

function submitRoot() {
  fireEvent.click(
    screen.getByRole("button", { name: "Buscar raiz e filiais" }),
  );
}

function submitRootForm() {
  fireEvent.submit(
    screen.getByRole("form", {
      name: "Formulário de busca por raiz e filiais",
    }),
  );
}

async function prepareRootSearch(value = "00ABC234000155") {
  selectRootMode();
  fireEvent.change(identifierInput("CNPJ completo"), {
    target: { value },
  });
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
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
  document.body.style.overflow = "";
});

describe("modo raiz e filiais", () => {
  it("shows the fourth mode, preserves previous modes and starts with CNPJ", () => {
    render(<App />);
    for (const name of [
      "Por segmento",
      "Por região",
      "Por raio",
      "Por raiz/filiais",
    ]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    selectRootMode();
    expect(screen.getByRole("radio", { name: "CNPJ completo" })).toBeChecked();
    expect(identifierInput("CNPJ completo")).toHaveAttribute("type", "text");
    expect(screen.getByText(/frontend preserva o valor como texto/i)).toBeInTheDocument();
  });

  it("validates blank values and snapshots only the selected textual identifier", () => {
    expect(validateRootBranches(EMPTY_ROOT_BRANCHES_FORM)).toHaveProperty(
      "identifierValue",
    );
    expect(
      validateRootBranches({
        identifierKind: "root",
        identifierValue: "   ",
      }),
    ).toHaveProperty("identifierValue");
    expect(
      createRootBranchesSnapshot({
        identifierKind: "cnpj",
        identifierValue: "  00ABC234000155  ",
      }),
    ).toEqual({ identifier: { kind: "cnpj", cnpj: "00ABC234000155" } });
    expect(
      createRootBranchesSnapshot({
        identifierKind: "root",
        identifierValue: "  00123456  ",
      }),
    ).toEqual({ identifier: { kind: "root", cnpjRoot: "00123456" } });
  });

  it("rejects an empty submission and preserves alphanumeric CNPJ and leading zero root", async () => {
    render(<App />);
    selectRootMode();
    submitRoot();
    expect(await screen.findByText("Informe o CNPJ completo.")).toBeInTheDocument();
    expect(rootCalls()).toHaveLength(0);

    fireEvent.change(identifierInput("CNPJ completo"), {
      target: { value: "  00ABC234000155  " },
    });
    submitRoot();
    await screen.findByLabelText("Contexto da raiz");
    expect(Object.fromEntries(rootUrl(0).searchParams)).toEqual({
      limit: "50",
      offset: "0",
      cnpj: "00ABC234000155",
    });

    fireEvent.click(screen.getByRole("radio", { name: "Raiz do CNPJ" }));
    fireEvent.change(identifierInput("Raiz do CNPJ"), {
      target: { value: "00123456" },
    });
    submitRoot();
    await waitFor(() => expect(rootCalls()).toHaveLength(2));
    expect(Object.fromEntries(rootUrl(1).searchParams)).toEqual({
      limit: "50",
      offset: "0",
      cnpj_root: "00123456",
    });
  });

  it("shows a busy loading state and disables duplicate button submissions", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/root-branches?")
        ? new Promise<Response>(() => undefined)
        : defaultApi(input),
    );
    render(<App />);
    await prepareRootSearch();
    submitRoot();
    expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled();
    expect(
      screen.getByRole("region", { name: "Resultados por raiz e filiais" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Buscando estabelecimentos conhecidos...")).toBeInTheDocument();
    expect(rootCalls()).toHaveLength(1);
  });

  it("renders context, BASE_UTIL warning, backend order and separate Receita status", async () => {
    const items = [
      rootBranchEstablishment({
        razao_social: "PRIMEIRO DA API",
        cnpj_full: "00123456000195",
        establishment_role: "MATRIZ",
        matriz_filial: "1",
      }),
      rootBranchEstablishment({
        razao_social: "SEGUNDO DA API",
        cnpj_full: "00123456000276",
        cnpj_order: "0002",
        cnpj_dv: "76",
        establishment_role: "FILIAL",
        matriz_filial: "2",
        situacao_cadastral: "08",
      }),
      rootBranchEstablishment({
        razao_social: null,
        nome_fantasia: null,
        cnpj_full: "00123456000357",
        cnpj_order: "0003",
        cnpj_dv: "57",
        establishment_role: "UNKNOWN",
        matriz_filial: "9",
        data_inicio_atividade: null,
        municipio_nome: null,
        uf: null,
        cnae_principal: null,
        porte_codigo: null,
        capital_social: null,
        location_precision: null,
        has_geo: false,
      }),
    ];
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/root-branches?")
        ? Promise.resolve(response(rootBranchesPage(items)))
        : defaultApi(input),
    );
    render(<App />);
    await prepareRootSearch();
    submitRoot();

    const context = await screen.findByLabelText("Contexto da raiz");
    expect(context).toHaveTextContent("00123456");
    expect(context).toHaveTextContent("00123456000195");
    expect(context).toHaveTextContent("BASE_UTIL");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Esta consulta considera somente os estabelecimentos conhecidos na base útil do Sentinel.",
    );
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("PRIMEIRO DA API");
    expect(rows[2]).toHaveTextContent("SEGUNDO DA API");
    expect(rows[3]).toHaveTextContent("Desconhecido");
    expect(rows[1]).toHaveTextContent("Matriz");
    expect(rows[2]).toHaveTextContent("Filial");
    expect(rows[2]).toHaveTextContent("Código Receita: 08");
    expect(rows[2]).toHaveTextContent("Desconhecido (provisório)");
    expect(rows[3]).toHaveTextContent("—");
    expect(screen.queryByText(/cliente|prospect|atendido|não atendido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/todas as filiais|estrutura completa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total geral/i)).not.toBeInTheDocument();

    fireEvent.click(within(rows[1]).getByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Detalhes do estabelecimento",
    );
  });

  it("keeps root context, BASE_UTIL warning and pagination on an empty success", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/root-branches?")
        ? Promise.resolve(
            response(
              rootBranchesPage(
                [],
                { offset: 9999 },
                rootBranchesContext({ reference_cnpj_full: null }),
              ),
            ),
          )
        : defaultApi(input),
    );
    render(<App />);
    await prepareRootSearch("00123456");
    submitRoot();
    expect(
      await screen.findByText(
        "Nenhum estabelecimento conhecido foi encontrado nesta página.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contexto da raiz")).toHaveTextContent("—");
    expect(screen.getByRole("note")).toHaveTextContent("BASE_UTIL");
    expect(screen.getByLabelText("Paginação dos resultados")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("paginates with the submitted snapshot and resets offset on limit change", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    fetchMock.mockImplementation(
      (input: RequestInfo | URL) => {
        if (!input.toString().includes("/root-branches?")) {
          return defaultApi(input);
        }
        const url = new URL(input.toString(), "http://local");
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        return Promise.resolve(
          response(
            rootBranchesPage(undefined, {
              offset,
              limit,
              has_more: offset === 0,
            }),
          ),
        );
      },
    );
    render(<App />);
    await prepareRootSearch("00123456000195");
    submitRoot();
    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(rootUrl(0).searchParams.get("offset")).toBe("0");

    fireEvent.change(identifierInput("CNPJ completo"), {
      target: { value: "OUTRO VALOR" },
    });
    const abortsBeforeNext = abortSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText(/Página 2/);
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeNext);
    expect(rootUrl(1).searchParams.get("offset")).toBe("50");
    expect(rootUrl(1).searchParams.get("cnpj")).toBe("00123456000195");
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText(/Página 1/);
    expect(rootUrl(2).searchParams.get("offset")).toBe("0");

    fireEvent.change(screen.getByLabelText("Resultados por página"), {
      target: { value: "25" },
    });
    await waitFor(() => expect(rootCalls()).toHaveLength(4));
    expect(rootUrl(3).searchParams.get("limit")).toBe("25");
    expect(rootUrl(3).searchParams.get("offset")).toBe("0");
    expect(rootUrl(3).searchParams.get("cnpj")).toBe("00123456000195");
    abortSpy.mockRestore();
  });

  it("retries the exact nonzero request and aborts the previous controller", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    let calls = 0;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL) => {
        if (!input.toString().includes("/root-branches?")) {
          return defaultApi(input);
        }
        calls += 1;
        if (calls === 1) {
          return Promise.resolve(
            response(rootBranchesPage(undefined, { has_more: true })),
          );
        }
        return Promise.resolve(
          response(
            { error: { code: "database_unavailable", message: "private" } },
            503,
          ),
        );
      },
    );
    render(<App />);
    await prepareRootSearch("00ABC234000155");
    submitRoot();
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    fireEvent.change(identifierInput("CNPJ completo"), {
      target: { value: "VALOR EDITADO" },
    });
    const abortsBeforeRetry = abortSpy.mock.calls.length;
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    await waitFor(() => expect(rootCalls()).toHaveLength(3));
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeRetry);
    expect(rootUrl(2).search).toBe(rootUrl(1).search);
    expect(Object.fromEntries(rootUrl(2).searchParams)).toEqual({
      limit: "50",
      offset: "50",
      cnpj: "00ABC234000155",
    });
    abortSpy.mockRestore();
  });

  it("aborts on new search, mode change and unmount without public cancellation", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (!input.toString().includes("/root-branches?")) {
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
    await prepareRootSearch();
    submitRootForm();
    submitRootForm();
    expect(signals[0].aborted).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Por segmento" }));
    expect(signals[1].aborted).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    selectRootMode();
    submitRootForm();
    view.unmount();
    expect(signals[2].aborted).toBe(true);
  });

  it("ignores an obsolete response after a newer root search", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("/root-branches?")) {
        return defaultApi(input);
      }
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    render(<App />);
    await prepareRootSearch("00123456000195");
    submitRootForm();
    fireEvent.change(identifierInput("CNPJ completo"), {
      target: { value: "00ABC234000155" },
    });
    submitRootForm();

    await act(async () => {
      resolvers[1](
        response(
          rootBranchesPage(
            [rootBranchEstablishment({ razao_social: "RESULTADO NOVO" })],
            { offset: 0 },
            rootBranchesContext({ cnpj_root: "00ABC234" }),
          ),
        ),
      );
    });
    expect(await screen.findByText("RESULTADO NOVO")).toBeInTheDocument();

    await act(async () => {
      resolvers[0](
        response(
          rootBranchesPage(
            [rootBranchEstablishment({ razao_social: "RESULTADO ANTIGO" })],
            { offset: 50 },
            rootBranchesContext({ cnpj_root: "00123456" }),
          ),
        ),
      );
    });
    expect(screen.queryByText("RESULTADO ANTIGO")).not.toBeInTheDocument();
    expect(screen.getByText("RESULTADO NOVO")).toBeInTheDocument();
    expect(screen.getByLabelText("Contexto da raiz")).toHaveTextContent(
      "00ABC234",
    );
    expect(screen.getByText(/Página 1/)).toBeInTheDocument();
  });

  it.each([
    [
      "reference_not_found",
      404,
      "O estabelecimento de referência não foi encontrado na base útil.",
    ],
    [
      "root_not_found",
      404,
      "A raiz informada não foi encontrada na base útil.",
    ],
    [
      "invalid_request",
      422,
      "A API rejeitou os critérios da busca por raiz e filiais.",
    ],
    [
      "database_unavailable",
      503,
      "A busca por raiz e filiais não está disponível porque o banco do Sentinel está indisponível.",
    ],
  ])("maps %s without exposing the backend message", async (code, status, text) => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/root-branches?")
        ? Promise.resolve(
            response({ error: { code, message: "private SQL DSN" } }, status),
          )
        : defaultApi(input),
    );
    render(<App />);
    await prepareRootSearch();
    submitRoot();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByText("private SQL DSN")).not.toBeInTheDocument();
  });

  it("maps malformed success and network failure without turning them into empty pages", async () => {
    let attempts = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("/root-branches?")) {
        return defaultApi(input);
      }
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(
          response({
            root: rootBranchesContext(),
            items: [{ cnpj_full: 123 }],
            pagination: {},
          }),
        );
      }
      return Promise.reject(new TypeError("private network stack"));
    });
    render(<App />);
    await prepareRootSearch();
    submitRoot();
    expect(
      await screen.findByText("Resposta inválida da API. Tente novamente mais tarde."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Nenhum estabelecimento conhecido foi encontrado nesta página.",
      ),
    ).not.toBeInTheDocument();

    submitRoot();
    expect(
      await screen.findByText(
        "Não foi possível concluir a busca por raiz e filiais. Verifique a conexão e tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("private network stack")).not.toBeInTheDocument();
  });

  it("uses the drawer shortcut once, aborts similar search and focuses root results", async () => {
    let similarSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url.includes("/similar?")) {
          similarSignal = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
        }
        return defaultApi(input);
      },
    );
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/Segmento/), {
      target: { value: "metal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhes" }),
    );
    expect(rootCalls()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Ver semelhantes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver raiz e filiais" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Empresas semelhantes");
    fireEvent.click(screen.getByRole("button", { name: "Ver raiz e filiais" }));

    expect(similarSignal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Por raiz/filiais" })).toBeChecked();
    expect(identifierInput("CNPJ completo")).toHaveValue("00AB345600019X");
    await waitFor(() => expect(rootCalls()).toHaveLength(1));
    expect(Object.fromEntries(rootUrl(0).searchParams)).toEqual({
      limit: "50",
      offset: "0",
      cnpj: "00AB345600019X",
    });
    const heading = await screen.findByRole("heading", {
      name: "Resultados por raiz e filiais",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(fetchMock.mock.calls.every(([, init]) => !init || init.method === "GET")).toBe(true);
  });
});

describe("guards de raiz e filiais", () => {
  it("accepts the strict textual contract and rejects malformed values", () => {
    const valid = rootBranchesPage();
    expect(isRootBranchesPage(valid)).toBe(true);
    const item = valid.items[0];
    const malformed: unknown[] = [
      { ...valid, root: { ...valid.root, data_scope: "RECEITA_COMPLETA" } },
      { ...valid, root: { ...valid.root, cnpj_root: 123 } },
      { ...valid, items: [{ ...item, cnpj_full: 123 }] },
      { ...valid, items: [{ ...item, cnpj_root: 123 }] },
      { ...valid, items: [{ ...item, cnpj_order: 1 }] },
      { ...valid, items: [{ ...item, cnpj_dv: 95 }] },
      { ...valid, items: [{ ...item, codigo_tom: 1 }] },
      { ...valid, items: [{ ...item, codigo_ibge: 550308 }] },
      { ...valid, items: [{ ...item, cnae_principal: 123456 }] },
      { ...valid, items: [{ ...item, porte_codigo: 3 }] },
      { ...valid, items: [{ ...item, capital_social: 5000.5 }] },
      { ...valid, items: [{ ...item, situacao_cadastral: 2 }] },
      { ...valid, items: [{ ...item, data_inicio_atividade: 20190101 }] },
      { ...valid, items: [{ ...item, matched_by_cnae_principal: 1 }] },
      { ...valid, items: [{ ...item, has_geo: "true" }] },
      { ...valid, items: [{ ...item, establishment_role: "HEADQUARTERS" }] },
      { ...valid, items: [{ ...item, commercial_status: "CLIENT" }] },
      { ...valid, items: [{ ...item, commercial_status_source: "erp" }] },
      { ...valid, items: [{ ...item, is_erp_customer: true }] },
      { ...valid, items: [{ ...item, is_unattended_branch: true }] },
      { ...valid, items: [{ ...item, branch_group: "customer" }] },
      {
        ...valid,
        pagination: { limit: 0, offset: 0, returned: 1, has_more: false },
      },
    ];
    for (const page of malformed) {
      expect(isRootBranchesPage(page)).toBe(false);
    }
    expect(publicRootBranchesError("request_timeout")).toBe(
      "A busca excedeu o tempo limite. Tente novamente.",
    );
  });
});
