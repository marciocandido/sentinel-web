import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { establishment } from "../../test/fixtures";
import { WorklistsPanel } from "./WorklistsPanel";

const fetchMock = vi.fn();
const id = "3b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498";
const search = { kind: "SEGMENT" as const, segment_id: "metal" };
const item = { worklist_id: id, name: "Visitas", source_search: search, item_count: 2, created_at: "2026-08-17T12:00:00Z" };
function response(body: unknown, status = 200): Response { return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response; }
function page(items: unknown[] = [item], offset = 0, has_more = false) { return { items, pagination: { limit: 20, offset, returned: items.length, has_more } }; }
function memberPage(items: unknown[], offset = 0, has_more = false) { return { items, pagination: { limit: 20, offset, returned: items.length, has_more } }; }

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("WorklistsPanel", () => {
  it("is lazy and loads under StrictMode without staying in loading", async () => {
    fetchMock.mockResolvedValue(response(page()));
    render(<StrictMode><WorklistsPanel search={null} generation={0} /></StrictMode>);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    expect(await screen.findByText("Visitas")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("creates from the submitted snapshot and invalidates the old save attempt", async () => {
    fetchMock.mockResolvedValueOnce(response(item, 201));
    const { rerender } = render(<WorklistsPanel search={search} generation={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar como lista de trabalho" }));
    fireEvent.change(screen.getByLabelText("Nome da lista de trabalho"), { target: { value: " Agosto " } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).search).toEqual(search);

    rerender(<WorklistsPanel search={{ kind: "REGION", uf: "RJ" }} generation={4} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar como lista de trabalho" }));
    expect(screen.getByLabelText("Nome da lista de trabalho")).toHaveValue("");
  });

  it("opens members without executing Discovery and preserves unknown members", async () => {
    fetchMock
      .mockResolvedValueOnce(response(page()))
      .mockResolvedValueOnce(response(memberPage([
        { ordinal: 0, cnpj_full: "00123456000195", establishment_known: true, establishment: establishment() },
        { ordinal: 1, cnpj_full: "00ABC123000100", establishment_known: false, establishment: null },
      ])));
    render(<WorklistsPanel search={null} generation={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    await screen.findByText("Visitas");
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByText("Não encontrado na base atual")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/discovery/worklists?limit=20&offset=0",
      `/api/v1/discovery/worklists/${id}/items?limit=20&offset=0`,
    ]);
    expect(screen.getByText("00123456000195")).toBeInTheDocument();
    expect(screen.getByText("00ABC123000100")).toBeInTheDocument();
  });

  it("paginates worklists with limit and offset without inventing a total", async () => {
    const next = { ...item, worklist_id: "4b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498", name: "Próxima" };
    fetchMock.mockResolvedValueOnce(response(page([item], 0, true))).mockResolvedValueOnce(response(page([next], 20)));
    render(<WorklistsPanel search={null} generation={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    await screen.findByText("Visitas");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Próxima", { selector: "strong" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/discovery/worklists?limit=20&offset=0",
      "/api/v1/discovery/worklists?limit=20&offset=20",
    ]);
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });

  it("does not delete before confirmation, reconciles after 204 and refreshes a 404", async () => {
    fetchMock
      .mockResolvedValueOnce(response(page()))
      .mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() } as unknown as Response)
      .mockResolvedValueOnce(response(page([])));
    render(<WorklistsPanel search={null} generation={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    await screen.findByText("Visitas");
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce(response({ error: { code: "worklist_not_found", message: "private" } }, 404)).mockResolvedValueOnce(response(page([])));
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    await screen.findByText("Visitas");
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta lista de trabalho já não existe.");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("aborts a read on unmount", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { unmount } = render(<WorklistsPanel search={null} generation={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Listas de trabalho" }));
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
