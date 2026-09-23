import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { discoveryPage, establishment } from "../../test/fixtures";

vi.mock("./RadiusMap", () => ({
  RadiusMap: ({ accessibleName }: { accessibleName?: string }) => <div role="img" aria-label={accessibleName ?? "Mapa"} />,
}));

const runtime = runtimeStatus();
const catalog = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/api/v1/runtime/status")) return Promise.resolve(jsonResponse(runtime));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  const parsed = new URL(url, "http://sentinel.local");
  return Promise.resolve(jsonResponse(discoveryPage([establishment()], {
    limit: Number(parsed.searchParams.get("limit")),
    offset: Number(parsed.searchParams.get("offset")),
  })));
}

const moreFilters = () => screen.getByText("Mais filtros e opções").closest("details") as HTMLDetailsElement;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("Critérios da busca", () => {
  it("presents the six modes as one accessible radio group with short names", async () => {
    render(<App />);
    expect(await screen.findByRole("radio", { name: "Por segmento" })).toBeChecked();
    expect(screen.getByRole("group", { name: "Modo de busca" })).toBeInTheDocument();
    const modes = screen.getAllByRole("radio").filter((input) => (input as HTMLInputElement).name === "search-mode");
    expect(modes.map((input) => input.getAttribute("value"))).toEqual([
      "segment", "region", "radius", "neighbors", "root", "group",
    ]);
  });

  it("keeps mode selection reachable and operable from the keyboard", async () => {
    render(<App />);
    const segment = await screen.findByRole("radio", { name: "Por segmento" });
    const region = screen.getByRole("radio", { name: "Por região" });
    region.focus();
    expect(region).toHaveFocus();
    fireEvent.click(region);
    expect(region).toBeChecked();
    expect(segment).not.toBeChecked();
    expect(screen.getByLabelText("Nome do município")).toBeInTheDocument();
  });

  it("collapses complementary filters by default and preserves their values when reopened", async () => {
    render(<App />);
    await screen.findByRole("radio", { name: "Por segmento" });
    expect(moreFilters().open).toBe(false);

    fireEvent.change(screen.getByLabelText("Capital mínimo"), { target: { value: "100.00" } });
    fireEvent.change(screen.getByLabelText("Código TOM"), { target: { value: "0012" } });
    expect(screen.getByText("2")).toBeInTheDocument();

    moreFilters().open = true;
    moreFilters().open = false;
    moreFilters().open = true;

    expect(screen.getByLabelText("Capital mínimo")).toHaveValue("100.00");
    expect(screen.getByLabelText("Código TOM")).toHaveValue("0012");
  });

  it("keeps the single discarded control inside the search options block", async () => {
    render(<App />);
    await screen.findByRole("radio", { name: "Por segmento" });
    const toggle = screen.getByRole("checkbox", { name: "Mostrar descartados" });
    expect(moreFilters().contains(toggle)).toBe(true);
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Por raio" }));
    const radiusToggle = screen.getByRole("checkbox", { name: "Mostrar descartados" });
    expect(screen.getAllByRole("checkbox", { name: "Mostrar descartados" })).toHaveLength(1);
    expect(radiusToggle).toBeChecked();
    expect(moreFilters().contains(radiusToggle)).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => input.toString().includes("/api/v1/discovery/"))).toBe(false);
  });

  it("keeps a single primary action at the start of the main filter row", async () => {
    render(<App />);
    await screen.findByLabelText(/Segmento/);
    const action = screen.getByRole("button", { name: "Buscar" });
    expect(action).toHaveClass("primary-button");
    expect(action).toHaveAttribute("type", "submit");
    expect(screen.getAllByRole("button", { name: /^Buscar/ })).toHaveLength(1);
    const row = action.closest(".form-grid") as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.firstElementChild).toBe(action.closest(".field-group--action"));
    expect(row.querySelector("#segment")).not.toBeNull();
    expect(document.querySelector(".search-actions")).toBeNull();
  });

  it.each([
    ["Por segmento", "Buscar"],
    ["Por região", "Buscar"],
    ["Por raio", "Buscar por raio"],
    ["Por vizinhos", "Buscar vizinhos"],
    ["Por raiz/filiais", "Buscar raiz e filiais"],
    ["Por grupo", "Buscar grupo"],
  ] as const)("keeps one inline action and no ordering note in %s", async (mode, label) => {
    render(<App />);
    fireEvent.click(await screen.findByRole("radio", { name: mode }));
    expect(screen.queryByText(/ordem definida pelo backend/)).not.toBeInTheDocument();
    const action = screen.getByRole("button", { name: label });
    expect(action).toHaveAttribute("type", "submit");
    expect(action.closest(".form-grid")?.firstElementChild).toBe(action.closest(".field-group--action"));
    expect(screen.getAllByRole("button", { name: new RegExp(`^${label}$`) })).toHaveLength(1);
    expect(document.querySelector(".search-actions")).toBeNull();
  });

  it("submits with Enter from a main filter field", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "metal-mecanica" } });
    const form = screen.getByRole("form", { name: "Formulário de busca" });
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => input.toString().includes("/api/v1/discovery/segments/"))).toBe(true));
  });

  it("keeps the header title and hint on the same block", async () => {
    render(<App />);
    const title = await screen.findByRole("heading", { name: "Buscar empresas", level: 1 });
    const intro = title.parentElement as HTMLElement;
    expect(intro).toHaveClass("page-intro");
    expect(intro.querySelector(".page-intro__hint")).toHaveTextContent(/Pesquise por segmento/);
    expect(intro.children).toHaveLength(2);
  });

  it("offers saved searches and worklists as toolbar actions that are not modes", async () => {
    render(<App />);
    await screen.findByRole("radio", { name: "Por segmento" });
    const saved = screen.getByRole("button", { name: "Pesquisas salvas" });
    const worklists = screen.getByRole("button", { name: "Listas de trabalho" });
    expect(screen.getAllByRole("radio").filter((input) => (input as HTMLInputElement).name === "search-mode")).toHaveLength(6);
    expect(screen.queryByRole("radio", { name: "Pesquisas salvas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Listas de trabalho" })).not.toBeInTheDocument();
    const toolbar = saved.closest(".search-toolbar") as HTMLElement;
    expect(toolbar).not.toBeNull();
    expect(toolbar.contains(worklists)).toBe(true);
    expect(toolbar.querySelector(".mode-switcher")).not.toBeNull();
    expect(saved).toHaveAttribute("aria-expanded", "false");
    expect(worklists).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps no permanent panel between the criteria and the results", async () => {
    render(<App />);
    await screen.findByRole("radio", { name: "Por segmento" });
    expect(document.querySelector(".saved-searches")).toBeNull();
    expect(document.querySelector(".worklists")).toBeNull();

    const saved = screen.getByRole("button", { name: "Pesquisas salvas" });
    fireEvent.click(saved);
    expect(saved).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("heading", { name: "Pesquisas salvas" })).toBeInTheDocument();
    expect(document.querySelector(".worklists")).toBeNull();

    const worklists = screen.getByRole("button", { name: "Listas de trabalho" });
    fireEvent.click(worklists);
    expect(document.querySelector(".saved-searches")).toBeNull();
    expect(await screen.findByRole("heading", { name: "Listas de trabalho" })).toBeInTheDocument();

    fireEvent.click(worklists);
    expect(worklists).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".worklists")).toBeNull();
    expect(document.querySelector(".saved-searches")).toBeNull();
  });

  it("does not show the Receita badge in the main content", async () => {
    render(<App />);
    await screen.findByRole("radio", { name: "Por segmento" });
    expect(document.getElementById("app-content")?.querySelector(".runtime-base")).toBeNull();
    expect(document.querySelector(".base-competence")).toBeNull();
    expect(document.querySelector(".monthly-update-panel")).toBeNull();
    const badge = document.querySelector(".sidebar .runtime-base");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("2026-07");
  });
});
