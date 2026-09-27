import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SavedSearchesDrawer } from "./SavedSearchesDrawer";

const fetchMock = vi.fn();
const identifier = "2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498";
const search = { kind: "SEGMENT" as const, segment_id: "metal", uf: "SP", porte_codigo: "03" };
const item = { saved_search_id: identifier, name: "Metal", search, created_at: "2026-08-13T12:00:00Z" };
function response(body: unknown, status = 200): Response { return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response; }
function page(items: unknown[] = [item]) { return { items, pagination: { limit: 20, offset: 0, returned: items.length, has_more: false } }; }
const segmentName = (id: string) => (id === "metal" ? "Metal-mecânica" : id);

function renderDrawer(overrides: Partial<Parameters<typeof SavedSearchesDrawer>[0]> = {}) {
  const props = { onClose: vi.fn(), onLoad: vi.fn(), returnFocusTo: null, segmentName, ...overrides };
  return { props, ...render(<SavedSearchesDrawer {...props} />) };
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("SavedSearchesDrawer", () => {
  it("loads under StrictMode as a modal dialog with human family and criteria summary", async () => {
    fetchMock.mockResolvedValue(response(page()));
    render(<StrictMode><SavedSearchesDrawer onClose={vi.fn()} onLoad={vi.fn()} returnFocusTo={null} segmentName={segmentName} /></StrictMode>);
    const dialog = screen.getByRole("dialog", { name: "Pesquisas salvas" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(await screen.findByRole("heading", { name: "Metal" })).toBeInTheDocument();
    expect(within(dialog).getByText("Filtros · Segmento")).toBeInTheDocument();
    expect(within(dialog).getByText("Segmento Metal-mecânica · UF SP · Porte 03")).toBeInTheDocument();
    expect(within(dialog).queryByText(/SEGMENT|FILTERED|REGION/)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("loads criteria without executing a search", async () => {
    fetchMock.mockResolvedValue(response(page()));
    const { props } = renderDrawer();
    fireEvent.click(await screen.findByRole("button", { name: "Carregar critérios de Metal" }));
    expect(props.onLoad).toHaveBeenCalledWith(expect.objectContaining({ mode: "filtered", origin: "SEGMENT" }), item);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("focuses close, traps Tab, closes with Escape and returns focus to the trigger", async () => {
    fetchMock.mockResolvedValue(response(page()));
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const onClose = vi.fn();
    const view = renderDrawer({ onClose, returnFocusTo: trigger });
    const close = screen.getByRole("button", { name: "Fechar pesquisas salvas" });
    expect(close).toHaveFocus();
    await screen.findByRole("heading", { name: "Metal" });
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Excluir Metal" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("requires confirmation before deleting and reconciles after 204", async () => {
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() } as unknown as Response).mockResolvedValueOnce(response(page([])));
    renderDrawer();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Metal" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Listas de trabalho já criadas não são afetadas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Excluir pesquisa" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
    expect(await screen.findByText("Nenhuma pesquisa salva.")).toBeInTheDocument();
  });

  it("cancels a pending confirmation without deleting", async () => {
    fetchMock.mockResolvedValue(response(page()));
    renderDrawer();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Metal" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: "Excluir pesquisa" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a delete 404 and refreshes the list", async () => {
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce(response({ error: { code: "saved_search_not_found", message: "private" } }, 404)).mockResolvedValueOnce(response(page([])));
    renderDrawer();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Metal" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir pesquisa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta pesquisa já não existe.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("keeps Similar searches deletable with a controlled note instead of a load action", async () => {
    const similar = { ...item, name: "Semelhantes", search: { kind: "SIMILAR" as const, cnpj_full: "00ABC", uf: null, codigo_tom: null, segment_id: null, radius_km: null } };
    fetchMock.mockResolvedValue(response(page([similar])));
    renderDrawer();
    expect(await screen.findByText("Não pode ser carregada como busca principal nesta versão.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carregar critérios/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Semelhantes" })).toBeEnabled();
  });

  it.each([
    ["FILTERED", { kind: "FILTERED", municipio_nome: "DIADEMA", capital_min: "100000.00" }, "Filtros", "Município DIADEMA · Capital mínimo R$ 100.000,00"],
    ["REGION", { kind: "REGION", uf: "PR", codigo_ibge: "0410000" }, "Filtros · Região", "UF PR · Código IBGE 0410000"],
    ["RADIUS", { kind: "RADIUS", radius_km: 15, origin_municipio_nome: "DIADEMA", origin_uf: "SP" }, "Proximidade · Raio", "Origem município DIADEMA/SP · Raio 15 km · UF dos resultados todas"],
    ["NEIGHBORS", { kind: "NEIGHBORS", cnpj_full: "00ABC234000155", radius_km: 10, include_discarded: true }, "Proximidade · Vizinhos", "CNPJ de referência 00ABC234000155 · Raio 10 km · UF dos resultados todas · Origem excluída dos resultados · inclui descartados"],
    ["ROOT_BRANCHES", { kind: "ROOT_BRANCHES", cnpj_root: "00123456" }, "Estrutura · Raiz e filiais", "Identificado por raiz 00123456"],
    ["COMMERCIAL_GROUP", { kind: "COMMERCIAL_GROUP", group_id: "GRP-0042" }, "Estrutura · Grupo comercial", "Grupo GRP-0042"],
  ])("summarizes %s with its family label", async (_kind, spec, label, summary) => {
    fetchMock.mockResolvedValue(response(page([{ ...item, search: spec }])));
    renderDrawer();
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText(summary)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carregar critérios de Metal" })).toBeInTheDocument();
  });
});
