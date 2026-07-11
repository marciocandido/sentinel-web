import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { discoveryPage, establishment } from "../../test/fixtures";

const liveness = { status: "ok", service: "sentinel-api" } as const;
const catalog = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
const items = [
  establishment({
    razao_social: "PRIMEIRA EMPRESA",
    nome_fantasia: "PRIMEIRA",
    cnpj_full: "00123456000195",
    cnpj_root: "00123456",
    codigo_tom: "0012",
    codigo_ibge: "03550308",
    cnae_principal: "02511000",
    porte_codigo: "03",
    capital_social: "000500000.00",
    has_geo: true,
  }),
  establishment({
    razao_social: "SEGUNDA EMPRESA",
    cnpj_full: "12AB345600019X",
    cnpj_root: "12AB3456",
    matched_by_cnae_principal: false,
    matched_by_cnae_secundario: true,
    has_geo: false,
  }),
  establishment({
    razao_social: null,
    nome_fantasia: null,
    cnpj_full: "00000000000003",
    cnpj_root: "00000000",
    municipio_nome: null,
    uf: null,
    codigo_tom: null,
    codigo_ibge: null,
    cnae_principal: null,
    porte_codigo: null,
    capital_social: null,
    location_precision: null,
    matched_by_cnae_principal: true,
    matched_by_cnae_secundario: true,
    has_geo: false,
  }),
];

const fetchMock = vi.fn();
const writeTextMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/health/live")) return Promise.resolve(jsonResponse(liveness));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  const parsed = new URL(url, "http://sentinel.local");
  return Promise.resolve(jsonResponse(discoveryPage(items, {
    limit: Number(parsed.searchParams.get("limit")),
    offset: Number(parsed.searchParams.get("offset")),
    has_more: true,
  })));
}

async function renderResults() {
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "metal-mecanica" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  return screen.findAllByRole("button", { name: "Ver detalhes" });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
  writeTextMock.mockReset();
  writeTextMock.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: writeTextMock },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
  document.body.style.overflow = "";
});

describe("Discovery establishment details drawer", () => {
  it("starts closed, exposes one semantic action per row and opens the correct item without another API call", async () => {
    const buttons = await renderResults();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(buttons).toHaveLength(3);
    const callsBeforeOpen = fetchMock.mock.calls.length;
    fireEvent.click(buttons[1]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Detalhes do estabelecimento");
    expect(within(dialog).getByText("SEGUNDA EMPRESA")).toBeInTheDocument();
    expect(within(dialog).getByText("12AB345600019X")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeOpen);
    expect(screen.getByText("Buscar empresas").closest(".discovery-content")).toHaveAttribute("inert");
  });

  it("moves focus inside, traps Tab and Shift+Tab, closes with Escape and returns focus", async () => {
    const buttons = await renderResults();
    const trigger = buttons[0];
    trigger.focus();
    fireEvent.click(trigger);
    const closeButton = screen.getByRole("button", { name: "Fechar detalhes" });
    const copyButton = screen.getByRole("button", { name: "Copiar CNPJ" });
    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    copyButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(copyButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes with the explicit button, clears the panel and restores focus", async () => {
    const buttons = await renderResults();
    const trigger = buttons[0];
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("replaces the selected establishment with the exact next result", async () => {
    const buttons = await renderResults();
    fireEvent.click(buttons[0]);
    expect(within(screen.getByRole("dialog")).getByText("PRIMEIRA EMPRESA")).toBeInTheDocument();
    buttons[1].focus();
    fireEvent.click(buttons[1]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("SEGUNDA EMPRESA")).toBeInTheDocument();
    expect(within(dialog).queryByText("PRIMEIRA EMPRESA")).not.toBeInTheDocument();
  });

  it("preserves textual identifiers, capital, match semantics and available geography", async () => {
    const buttons = await renderResults();
    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole("dialog");
    for (const value of [
      "00123456000195",
      "00123456",
      "0012",
      "03550308",
      "02511000",
      "03",
      "000500000.00",
      "Geografia disponível",
    ]) {
      expect(within(dialog).getByText(value)).toBeInTheDocument();
    }
    expect(within(dialog).getAllByText("CNAE principal")).toHaveLength(2);
  });

  it("preserves alphanumeric CNPJ and shows secondary match and unavailable geography", async () => {
    const buttons = await renderResults();
    fireEvent.click(buttons[1]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("12AB345600019X")).toBeInTheDocument();
    expect(within(dialog).getByText("12AB3456")).toBeInTheDocument();
    expect(within(dialog).getByText("CNAE secundário")).toBeInTheDocument();
    expect(within(dialog).getByText("Geografia não disponível")).toBeInTheDocument();
  });

  it("shows nulls as dashes, double match and only the provisional commercial status", async () => {
    const buttons = await renderResults();
    fireEvent.click(buttons[2]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("—").length).toBeGreaterThanOrEqual(7);
    expect(within(dialog).getByText("Principal e secundário")).toBeInTheDocument();
    expect(within(dialog).getByText("Desconhecido")).toBeInTheDocument();
    expect(within(dialog).getByText("nenhuma integração comercial disponível")).toBeInTheDocument();
    expect(within(dialog).queryByText(/cliente|prospect|atendido|ativo|inativo/i)).not.toBeInTheDocument();
  });

  it("copies exactly cnpj_full, shows success and makes no API call while opening, copying or closing", async () => {
    const buttons = await renderResults();
    const callsBeforeActions = fetchMock.mock.calls.length;
    fireEvent.click(buttons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Copiar CNPJ" }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("12AB345600019X"));
    expect(screen.getByText("CNPJ copiado.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeActions);
  });

  it("shows a public clipboard failure without internal details", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("clipboard internal stack"));
    const buttons = await renderResults();
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Copiar CNPJ" }));
    expect(await screen.findByText("Não foi possível copiar o CNPJ.")).toBeInTheDocument();
    expect(screen.queryByText(/internal stack/i)).not.toBeInTheDocument();
  });

  it("closes before a new search", async () => {
    const buttons = await renderResults();
    const form = screen.getByRole("form", { name: "Formulário de busca" });
    fireEvent.click(buttons[0]);
    fireEvent.submit(form);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the search mode changes", async () => {
    const buttons = await renderResults();
    const regionMode = screen.getByRole("radio", { name: "Por região" });
    fireEvent.click(buttons[0]);
    fireEvent.click(regionMode);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes before pagination", async () => {
    const buttons = await renderResults();
    const nextButton = screen.getByRole("button", { name: "Próxima" });
    fireEvent.click(buttons[0]);
    fireEvent.click(nextButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes before changing the result limit", async () => {
    const buttons = await renderResults();
    const limit = screen.getByLabelText("Resultados por página");
    fireEvent.click(buttons[0]);
    fireEvent.change(limit, { target: { value: "25" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores body scroll when the feature unmounts while open", async () => {
    const { unmount } = render(<App />);
    fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "metal-mecanica" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const trigger = (await screen.findAllByRole("button", { name: "Ver detalhes" }))[0];
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
