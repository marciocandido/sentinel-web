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
  commercialGroupContext,
  commercialGroupKnownEstablishment,
  commercialGroupPage,
  commercialGroupUnknownRoot,
  discoveryPage,
  radiusSearchPage,
  rootBranchesPage,
  similarCompanyPage,
} from "../../test/fixtures";
import {
  isCommercialGroupContext,
  isCommercialGroupItem,
  isCommercialGroupKnownEstablishment,
  isCommercialGroupPage,
  isCommercialGroupUnknownRoot,
} from "../../types/api";
import { EMPTY_COMMERCIAL_GROUP_FORM } from "./commercialGroupTypes";
import {
  createCommercialGroupSnapshot,
  publicCommercialGroupError,
  validateCommercialGroup,
} from "./commercialGroupUtils";

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
  if (url.includes("/catalog/segments")) {
    return Promise.resolve(response(catalog));
  }
  if (url.includes("/commercial-groups?")) {
    return Promise.resolve(response(commercialGroupPage()));
  }
  if (url.includes("/root-branches?")) {
    return Promise.resolve(response(rootBranchesPage()));
  }
  if (url.includes("/radius/establishments?")) {
    return Promise.resolve(response(radiusSearchPage()));
  }
  if (url.includes("/similar?")) {
    return Promise.resolve(response(similarCompanyPage()));
  }
  return Promise.resolve(response(discoveryPage()));
}

function groupCalls() {
  return fetchMock.mock.calls.filter(([input]) =>
    input.toString().includes("/commercial-groups?"),
  );
}

function groupUrl(index: number): URL {
  return new URL(groupCalls()[index][0].toString(), "http://local");
}

function selectGroupMode() {
  fireEvent.click(screen.getByRole("radio", { name: "Por grupo" }));
}

function groupInput() {
  return screen.getByRole("textbox", { name: "ID do grupo" });
}

function submitGroup() {
  fireEvent.click(screen.getByRole("button", { name: "Buscar grupo" }));
}

function submitGroupForm() {
  fireEvent.submit(
    screen.getByRole("form", {
      name: "Formulário de busca por grupo comercial",
    }),
  );
}

function prepareGroupSearch(value = "grupo-metal") {
  selectGroupMode();
  fireEvent.change(groupInput(), { target: { value } });
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

describe("modo grupo comercial", () => {
  it("shows the fifth accessible mode and preserves the four previous modes", () => {
    render(<App />);
    for (const name of [
      "Por segmento",
      "Por região",
      "Por raio",
      "Por raiz/filiais",
      "Por grupo",
    ]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }

    selectGroupMode();
    expect(groupInput()).toHaveAttribute("type", "text");
    expect(
      screen.getByText(/grupo previamente registrado no Sentinel/i),
    ).toBeInTheDocument();
    expect(groupCalls()).toHaveLength(0);
  });

  it("validates empty and whitespace values and trims only the submitted snapshot", () => {
    expect(validateCommercialGroup(EMPTY_COMMERCIAL_GROUP_FORM)).toHaveProperty(
      "groupId",
    );
    expect(validateCommercialGroup({ groupId: "   " })).toHaveProperty(
      "groupId",
    );
    expect(
      createCommercialGroupSnapshot({ groupId: "  grupo A/01 & X  " }),
    ).toEqual({ groupId: "grupo A/01 & X" });
  });

  it("rejects blank submission and preserves textual special characters in the URL", async () => {
    render(<App />);
    selectGroupMode();
    submitGroup();
    expect(await screen.findByText("Informe o ID do grupo.")).toBeInTheDocument();
    expect(groupInput()).toHaveAttribute("aria-invalid", "true");
    expect(groupCalls()).toHaveLength(0);

    fireEvent.change(groupInput(), {
      target: { value: "  grupo A/01 & X  " },
    });
    submitGroup();
    await screen.findByLabelText("Contexto do grupo comercial");
    expect(Object.fromEntries(groupUrl(0).searchParams)).toEqual({
      limit: "50",
      offset: "0",
      group_id: "grupo A/01 & X",
    });
    expect(groupUrl(0).search).toContain("%2F");
    expect(
      fetchMock.mock.calls.every(([, init]) => !init || init.method === "GET"),
    ).toBe(true);
  });

  it("renders loading with aria-busy and prevents duplicate button clicks", () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/commercial-groups?")
        ? new Promise<Response>(() => undefined)
        : defaultApi(input),
    );
    render(<App />);
    prepareGroupSearch();
    submitGroup();

    expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled();
    expect(
      screen.getByRole("region", { name: "Resultados por grupo comercial" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Buscando raízes registradas...")).toHaveAttribute(
      "role",
      "status",
    );
    expect(groupCalls()).toHaveLength(1);
  });

  it("renders context, mandatory scopes, API order and both item variants", async () => {
    const items = [
      commercialGroupUnknownRoot({
        cnpj_root: "00000001",
        relation_type: "manual-link",
        relation_source: "curadoria",
        confidence: null,
      }),
      commercialGroupKnownEstablishment({
        cnpj_root: "00AB3456",
        cnpj_full: "00AB345600019X",
        razao_social: "SEGUNDO DA API",
        nome_fantasia: "UNIDADE CONHECIDA",
        relation_type: "registered",
        relation_source: "manual",
        confidence: "0.8200",
        establishment_role: "FILIAL",
        matriz_filial: "2",
        situacao_cadastral: "02",
      }),
    ];
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/commercial-groups?")
        ? Promise.resolve(
            response(
              commercialGroupPage(
                items,
                {},
                commercialGroupContext({ name: "Grupo Metal Registrado" }),
              ),
            ),
          )
        : defaultApi(input),
    );
    render(<App />);
    prepareGroupSearch();
    submitGroup();

    const context = await screen.findByLabelText("Contexto do grupo comercial");
    expect(context).toHaveTextContent("grupo-metal");
    expect(context).toHaveTextContent("Grupo Metal Registrado");
    expect(context).toHaveTextContent("REGISTERED");
    expect(context).toHaveTextContent("BASE_UTIL");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Esta consulta mostra somente raízes explicitamente registradas no grupo.",
    );

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("00000001");
    expect(rows[1]).toHaveTextContent(
      "Estabelecimento não disponível na base útil",
    );
    expect(rows[1]).toHaveTextContent("manual-link");
    expect(rows[1]).toHaveTextContent("curadoria");
    expect(rows[1]).toHaveTextContent("—");
    expect(rows[1]).not.toHaveTextContent("Ver detalhes");
    expect(rows[2]).toHaveTextContent("SEGUNDO DA API");
    expect(rows[2]).toHaveTextContent("Filial");
    expect(rows[2]).toHaveTextContent("Código Receita: 02");
    expect(rows[2]).toHaveTextContent("registered");
    expect(rows[2]).toHaveTextContent("manual");
    expect(rows[2]).toHaveTextContent("Confiança cadastrada: 0.8200");
    expect(rows[2]).toHaveTextContent("Desconhecido (provisório)");
    expect(rows[2]).not.toHaveTextContent("%");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/baixa|média|alta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score|probabilidade|grupo confirmado/i)).not.toBeInTheDocument();

    expect(
      within(rows[1]).queryByRole("button", { name: "Ver detalhes" }),
    ).not.toBeInTheDocument();
    const detailButton = within(rows[2]).getByRole("button", {
      name: "Ver detalhes",
    });
    detailButton.focus();
    fireEvent.click(detailButton);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Detalhes do estabelecimento",
    );
    expect(
      screen.queryByRole("button", { name: /ver grupo/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    await waitFor(() => expect(detailButton).toHaveFocus());
  });

  it("keeps nullable name, context, warning and pagination on empty success", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/commercial-groups?")
        ? Promise.resolve(
            response(
              commercialGroupPage(
                [],
                { offset: 9999 },
                commercialGroupContext({ name: null }),
              ),
            ),
          )
        : defaultApi(input),
    );
    render(<App />);
    prepareGroupSearch();
    submitGroup();

    expect(
      await screen.findByText(
        "Nenhum item registrado foi encontrado nesta página.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contexto do grupo comercial")).toHaveTextContent(
      "Nome do grupo—",
    );
    expect(screen.getByRole("note")).toHaveTextContent("base útil");
    expect(screen.getByLabelText("Paginação dos resultados")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("paginates with the submitted snapshot and resets offset on limit change", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("/commercial-groups?")) {
        return defaultApi(input);
      }
      const url = new URL(input.toString(), "http://local");
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      return Promise.resolve(
        response(
          commercialGroupPage(undefined, {
            offset,
            limit,
            has_more: offset === 0,
          }),
        ),
      );
    });
    render(<App />);
    prepareGroupSearch("grupo-original");
    submitGroup();

    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(groupUrl(0).searchParams.get("offset")).toBe("0");
    fireEvent.change(groupInput(), { target: { value: "grupo-editado" } });
    const abortsBeforeNext = abortSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText(/Página 2/);
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeNext);
    expect(Object.fromEntries(groupUrl(1).searchParams)).toEqual({
      limit: "50",
      offset: "50",
      group_id: "grupo-original",
    });
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText(/Página 1/);
    expect(groupUrl(2).searchParams.get("offset")).toBe("0");

    fireEvent.change(screen.getByLabelText("Resultados por página"), {
      target: { value: "25" },
    });
    await waitFor(() => expect(groupCalls()).toHaveLength(4));
    expect(Object.fromEntries(groupUrl(3).searchParams)).toEqual({
      limit: "25",
      offset: "0",
      group_id: "grupo-original",
    });
    abortSpy.mockRestore();
  });

  it("retries the exact nonzero request and aborts the previous controller", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    let calls = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("/commercial-groups?")) {
        return defaultApi(input);
      }
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(
          response(commercialGroupPage(undefined, { has_more: true })),
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
    prepareGroupSearch("grupo A/01");
    submitGroup();
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    fireEvent.change(groupInput(), { target: { value: "outro grupo" } });
    const abortsBeforeRetry = abortSpy.mock.calls.length;
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    await waitFor(() => expect(groupCalls()).toHaveLength(3));
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeRetry);
    expect(groupUrl(2).search).toBe(groupUrl(1).search);
    expect(Object.fromEntries(groupUrl(2).searchParams)).toEqual({
      limit: "50",
      offset: "50",
      group_id: "grupo A/01",
    });
    abortSpy.mockRestore();
  });

  it("aborts on new search, mode change and unmount without public cancellation", () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (!input.toString().includes("/commercial-groups?")) {
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
    prepareGroupSearch();
    submitGroupForm();
    fireEvent.change(groupInput(), { target: { value: "grupo-dois" } });
    submitGroupForm();
    expect(signals[0].aborted).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Por segmento" }));
    expect(signals[1].aborted).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    prepareGroupSearch("grupo-tres");
    submitGroupForm();
    view.unmount();
    expect(signals[2].aborted).toBe(true);
  });

  it("ignores an obsolete response after a newer group search", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("/commercial-groups?")) {
        return defaultApi(input);
      }
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    render(<App />);
    prepareGroupSearch("grupo-antigo");
    submitGroupForm();
    fireEvent.change(groupInput(), { target: { value: "grupo-novo" } });
    submitGroupForm();

    await act(async () => {
      resolvers[1](
        response(
          commercialGroupPage(
            [
              commercialGroupKnownEstablishment({
                razao_social: "RESULTADO NOVO",
              }),
            ],
            { offset: 0 },
            commercialGroupContext({ group_id: "grupo-novo" }),
          ),
        ),
      );
    });
    expect(await screen.findByText("RESULTADO NOVO")).toBeInTheDocument();

    await act(async () => {
      resolvers[0](
        response(
          commercialGroupPage(
            [
              commercialGroupKnownEstablishment({
                razao_social: "RESULTADO ANTIGO",
              }),
            ],
            { offset: 50 },
            commercialGroupContext({ group_id: "grupo-antigo" }),
          ),
        ),
      );
    });
    expect(screen.queryByText("RESULTADO ANTIGO")).not.toBeInTheDocument();
    expect(screen.getByText("RESULTADO NOVO")).toBeInTheDocument();
    expect(screen.getByLabelText("Contexto do grupo comercial")).toHaveTextContent(
      "grupo-novo",
    );
    expect(screen.getByText(/Página 1/)).toBeInTheDocument();
  });

  it.each([
    [
      "group_not_found",
      404,
      "O grupo comercial informado não foi encontrado.",
    ],
    [
      "group_without_members",
      422,
      "O grupo existe, mas não possui raízes registradas.",
    ],
    [
      "invalid_request",
      422,
      "A API rejeitou os critérios da busca por grupo comercial.",
    ],
    [
      "database_unavailable",
      503,
      "A busca por grupo comercial não está disponível porque o banco do Sentinel está indisponível.",
    ],
  ])("maps %s without exposing backend details", async (code, status, text) => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      input.toString().includes("/commercial-groups?")
        ? Promise.resolve(
            response({ error: { code, message: "private SQL DSN" } }, status),
          )
        : defaultApi(input),
    );
    render(<App />);
    prepareGroupSearch();
    submitGroup();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByText("private SQL DSN")).not.toBeInTheDocument();
  });

  it("maps malformed success and network errors without an empty success", async () => {
    let attempts = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (!input.toString().includes("/commercial-groups?")) {
        return defaultApi(input);
      }
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(
          response({
            group: commercialGroupContext(),
            items: [{ establishment_known: false, cnpj_full: "invalid" }],
            pagination: {},
          }),
        );
      }
      return Promise.reject(new TypeError("private network stack"));
    });
    render(<App />);
    prepareGroupSearch();
    submitGroup();
    expect(
      await screen.findByText(
        "Resposta inválida da API. Tente novamente mais tarde.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum item registrado foi encontrado nesta página."),
    ).not.toBeInTheDocument();

    submitGroup();
    expect(
      await screen.findByText(
        "Não foi possível concluir a busca por grupo comercial. Verifique a conexão e tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("private network stack")).not.toBeInTheDocument();
  });
});

describe("guards de grupo comercial", () => {
  it("accepts context, known establishment and unknown root variants", () => {
    const context = commercialGroupContext();
    const known = commercialGroupKnownEstablishment();
    const unknown = commercialGroupUnknownRoot();
    expect(isCommercialGroupContext(context)).toBe(true);
    expect(isCommercialGroupKnownEstablishment(known)).toBe(true);
    expect(isCommercialGroupUnknownRoot(unknown)).toBe(true);
    expect(isCommercialGroupItem(known)).toBe(true);
    expect(isCommercialGroupItem(unknown)).toBe(true);
    expect(isCommercialGroupPage(commercialGroupPage())).toBe(true);
    expect(commercialGroupKnownEstablishment().confidence).toBe("0.8200");
    expect(
      isCommercialGroupItem(commercialGroupUnknownRoot({ confidence: null })),
    ).toBe(true);
  });

  it("rejects invalid contexts, association fields, confidence and pagination", () => {
    const valid = commercialGroupPage();
    const item = valid.items[0];
    const malformed: unknown[] = [
      { ...valid, group: { ...valid.group, group_id: 123 } },
      { ...valid, group: { ...valid.group, membership_scope: "INFERRED" } },
      {
        ...valid,
        group: { ...valid.group, establishment_data_scope: "RECEITA" },
      },
      { ...valid, items: [{ ...item, group_id: 1 }] },
      { ...valid, items: [{ ...item, cnpj_root: 123 }] },
      { ...valid, items: [{ ...item, relation_type: " " }] },
      { ...valid, items: [{ ...item, relation_source: "" }] },
      { ...valid, items: [{ ...item, confidence: 0.82 }] },
      { ...valid, items: [{ ...item, confidence: "" }] },
      { ...valid, items: [{ ...item, confidence: " " }] },
      { ...valid, items: [{ ...item, confidence: "NaN" }] },
      { ...valid, items: [{ ...item, confidence: "Infinity" }] },
      { ...valid, items: [{ ...item, confidence: "-Infinity" }] },
      { ...valid, items: [{ ...item, confidence: "0x1" }] },
      { ...valid, items: [{ ...item, confidence: "8.2e-1" }] },
      { ...valid, items: [{ ...item, confidence: "-0.01" }] },
      { ...valid, items: [{ ...item, confidence: "1.01" }] },
      { ...valid, items: [{ ...item, establishment_known: 1 }] },
      { ...valid, items: [{ ...item, is_erp_customer: 0 }] },
      { ...valid, items: [{ ...item, is_unattended_branch: "false" }] },
      { ...valid, items: [{ ...item, branch_group: "confirmed" }] },
      { ...valid, items: [{ ...item, commercial_status: "CLIENT" }] },
      { ...valid, items: [{ ...item, commercial_status_source: "erp" }] },
      {
        ...valid,
        pagination: { limit: 0, offset: 0, returned: 1, has_more: false },
      },
    ];
    for (const page of malformed) {
      expect(isCommercialGroupPage(page)).toBe(false);
    }
  });

  it("rejects every known/unknown discriminant inconsistency", () => {
    const known = commercialGroupKnownEstablishment();
    const unknown = commercialGroupUnknownRoot();
    const malformed: unknown[] = [
      { ...unknown, cnpj_full: "00123456000195" },
      { ...unknown, has_geo: true },
      { ...unknown, matched_by_cnae_principal: true },
      { ...unknown, matched_by_cnae_secundario: true },
      { ...known, cnpj_full: null },
      { ...known, cnpj_order: 1 },
      { ...known, cnpj_dv: 95 },
      { ...known, matriz_filial: null },
      { ...known, establishment_role: null },
      { ...known, establishment_role: "HEADQUARTERS" },
      { ...known, has_geo: "true" },
      { ...known, matched_by_cnae_principal: 1 },
      { ...known, codigo_tom: 1 },
      { ...known, codigo_ibge: 550308 },
      { ...known, cnae_principal: 123456 },
      { ...known, porte_codigo: 3 },
      { ...known, capital_social: 8200 },
    ];
    for (const item of malformed) {
      expect(isCommercialGroupItem(item)).toBe(false);
    }
    expect(publicCommercialGroupError("request_timeout")).toBe(
      "A busca excedeu o tempo limite. Tente novamente.",
    );
  });
});
