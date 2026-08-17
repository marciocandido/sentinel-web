import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SavedSearchesPanel } from "./SavedSearchesPanel";

const fetchMock = vi.fn();
const identifier = "2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498";
const search = { kind: "SEGMENT" as const, segment_id: "metal" };
const item = { saved_search_id: identifier, name: "Metal", search, created_at: "2026-08-13T12:00:00Z" };
function response(body: unknown, status = 200): Response { return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response; }
function page(items: unknown[] = [item]) { return { items, pagination: { limit: 20, offset: 0, returned: items.length, has_more: false } }; }

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("SavedSearchesPanel", () => {
  it("loads under StrictMode without staying in loading", async () => {
    fetchMock.mockResolvedValue(response(page()));
    render(<StrictMode><SavedSearchesPanel search={null} generation={0} onLoad={vi.fn()} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Pesquisas salvas" }));
    expect(await screen.findByText("Metal")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows save errors while the list remains closed", async () => {
    fetchMock.mockResolvedValue(response({ error: { code: "saved_search_name_conflict", message: "private" } }, 409));
    render(<SavedSearchesPanel search={search} generation={0} onLoad={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesquisa" }));
    fireEvent.change(screen.getByLabelText("Nome da pesquisa"), { target: { value: "Metal" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma pesquisa com esse nome.");
    expect(screen.queryByRole("heading", { name: "Pesquisas salvas" })).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting and reconciles after 204", async () => {
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() } as unknown as Response).mockResolvedValueOnce(response(page([])));
    render(<SavedSearchesPanel search={null} generation={0} onLoad={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pesquisas salvas" }));
    await screen.findByText("Metal");
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("reports a delete 404 and refreshes the list without touching Discovery state", async () => {
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce(response({ error: { code: "saved_search_not_found", message: "private" } }, 404)).mockResolvedValueOnce(response(page([])));
    render(<SavedSearchesPanel search={null} generation={0} onLoad={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pesquisas salvas" })); await screen.findByText("Metal");
    fireEvent.click(screen.getByRole("button", { name: "Excluir" })); fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta pesquisa já não existe.");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("keeps structurally valid Similar searches deletable without a load action", async () => {
    const similar = { ...item, search: { kind: "SIMILAR" as const, cnpj_full: "00ABC", uf: null, codigo_tom: null, segment_id: null, radius_km: null } };
    fetchMock.mockResolvedValue(response(page([similar])));
    render(<SavedSearchesPanel search={null} generation={0} onLoad={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pesquisas salvas" }));
    expect(await screen.findByText("Esta definição não pode ser carregada nesta versão da interface.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeEnabled();
  });
});
