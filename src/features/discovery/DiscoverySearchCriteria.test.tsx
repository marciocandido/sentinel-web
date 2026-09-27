import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { discoveryPage, establishment } from "../../test/fixtures";
import {
  chooseFamily,
  chooseProximity,
  chooseStructure,
  clickSearch,
  discoveryUrls,
  familyGroup,
  openMoreFilters,
  searchButton,
} from "../../test/discoveryUi";

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

const moreRegion = () => document.getElementById("more-filters") as HTMLElement;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("Critérios da busca — três famílias", () => {
  it("presents exactly three mutually exclusive families in one radiogroup, without technical names", async () => {
    render(<App />);
    await screen.findByLabelText(/^Segmento/);
    const radios = within(familyGroup()).getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual(["filters", "proximity", "structure"]);
    expect(radios.map((radio) => radio.getAttribute("name"))).toEqual(["discovery-family", "discovery-family", "discovery-family"]);
    expect(within(familyGroup()).getByRole("radio", { name: "Filtros" })).toBeChecked();
    expect(within(familyGroup()).getByRole("radio", { name: "Proximidade" })).toHaveAccessibleDescription("Empresas num raio a partir de uma origem");
    expect(within(familyGroup()).getByRole("radio", { name: "Estrutura" })).toHaveAccessibleDescription("Raiz e filiais ou grupo comercial registrado");
    expect(document.body.textContent).not.toMatch(/FILTERED|SEGMENT|REGION/);
    expect(screen.queryByRole("radio", { name: "Pesquisas salvas" })).not.toBeInTheDocument();
  });

  it("keeps family selection operable from the keyboard and never searches on change", async () => {
    render(<App />);
    await screen.findByLabelText(/^Segmento/);
    const proximity = within(familyGroup()).getByRole("radio", { name: "Proximidade" });
    proximity.focus();
    expect(proximity).toHaveFocus();
    fireEvent.click(proximity);
    expect(proximity).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: "Tipo" })).toBeInTheDocument();
    await chooseFamily("Estrutura");
    expect(screen.getByRole("radio", { name: "Raiz e filiais" })).toBeChecked();
    expect(discoveryUrls(fetchMock)).toHaveLength(0);
  });

  it("shows segment, UF and municipality as optional main fields of Filtros", async () => {
    render(<App />);
    expect(await screen.findByLabelText("Segmento (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("UF (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Município (opcional)")).toHaveAccessibleDescription("Nome exato. Sem busca aproximada.");
    expect(screen.queryByText(/Obrigatório se não houver localização/)).not.toBeInTheDocument();
    expect(screen.queryByText(/não combina/i)).not.toBeInTheDocument();
  });

  it("collapses complementary filters by default, counts only filled ones and preserves values", async () => {
    render(<App />);
    await screen.findByLabelText(/^Segmento/);
    const toggle = screen.getByRole("button", { name: /^Mais filtros/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "more-filters");
    expect(moreRegion()).not.toBeVisible();

    openMoreFilters();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByLabelText(/^Capital mínimo/), { target: { value: "100.00" } });
    fireEvent.change(screen.getByLabelText(/^Código TOM/), { target: { value: "0012" } });
    fireEvent.change(screen.getByLabelText(/^Código IBGE/), { target: { value: "   " } });
    expect(toggle).toHaveTextContent("2 ativos");

    fireEvent.click(toggle);
    expect(moreRegion()).not.toBeVisible();
    openMoreFilters();
    expect(screen.getByLabelText(/^Capital mínimo/)).toHaveValue("100.00");
    expect(screen.getByLabelText(/^Código TOM/)).toHaveValue("0012");
  });

  it("keeps one discarded control inside Mais filtros for every family and counts it", async () => {
    render(<App />);
    await screen.findByLabelText(/^Segmento/);
    openMoreFilters();
    const toggle = screen.getByRole("checkbox", { name: "Mostrar descartados" });
    expect(moreRegion().contains(toggle)).toBe(true);
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /^Mais filtros/ })).toHaveTextContent("1 ativo");

    await chooseProximity("Raio a partir de uma origem");
    expect(screen.getAllByRole("checkbox", { name: "Mostrar descartados" })).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Mostrar descartados" })).toBeChecked();
    await chooseStructure("Grupo comercial registrado");
    expect(moreRegion().contains(screen.getByRole("checkbox", { name: "Mostrar descartados" }))).toBe(true);
    expect(discoveryUrls(fetchMock)).toHaveLength(0);
  });

  it.each(["Filtros", "Proximidade", "Estrutura"] as const)("keeps one stable Buscar submit in the criteria footer for %s", async (family) => {
    render(<App />);
    await chooseFamily(family);
    const action = searchButton();
    expect(action).toHaveClass("primary-button");
    expect(action).toHaveAttribute("type", "submit");
    expect(action.closest(".criteria-footer")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Mais filtros/ }).closest(".criteria-footer")).toBe(action.closest(".criteria-footer"));
    expect(screen.getAllByRole("button", { name: /^Buscar$/ })).toHaveLength(1);
  });

  it("submits with Enter from a main filter field", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/^Segmento/), { target: { value: "metal-mecanica" } });
    fireEvent.submit(screen.getByRole("form", { name: "Critérios da busca" }));
    await waitFor(() => expect(discoveryUrls(fetchMock).some((url) => url.startsWith("/api/v1/discovery/establishments?"))).toBe(true));
  });

  it("presents the Discovery header with saved searches and worklists as auxiliary actions", async () => {
    render(<App />);
    const title = await screen.findByRole("heading", { name: "Buscar empresas", level: 1 });
    expect(title.closest(".page-intro")?.querySelector(".page-intro__hint")).toHaveTextContent(/filtros, proximidade ou estrutura/);
    const actions = screen.getByRole("group", { name: "Pesquisas salvas e listas" });
    const saved = within(actions).getByRole("button", { name: "Pesquisas salvas" });
    const worklists = within(actions).getByRole("button", { name: "Listas de trabalho" });
    expect(saved).toHaveAttribute("aria-haspopup", "dialog");
    expect(saved).toHaveAttribute("aria-expanded", "false");
    expect(worklists).toHaveAttribute("aria-expanded", "false");
  });

  it("opens saved searches as a dialog and worklists inline without permanent panels", async () => {
    render(<App />);
    await screen.findByLabelText(/^Segmento/);
    expect(document.querySelector(".worklists")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const savedTrigger = screen.getByRole("button", { name: "Pesquisas salvas" });
    savedTrigger.focus();
    fireEvent.click(savedTrigger);
    expect(await screen.findByRole("dialog", { name: "Pesquisas salvas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar pesquisas salvas" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Pesquisas salvas" })).toHaveFocus();

    const worklists = screen.getByRole("button", { name: "Listas de trabalho" });
    fireEvent.click(worklists);
    expect(await screen.findByRole("heading", { name: "Listas de trabalho" })).toBeInTheDocument();
    fireEvent.click(worklists);
    expect(worklists).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".worklists")).toBeNull();
  });

  it("shows a useful empty state before the first query", async () => {
    render(<App />);
    expect(await screen.findByText("Nenhuma consulta nesta sessão.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o tipo de busca, preencha os critérios e clique em Buscar.")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/centroide do município/);
    expect(screen.getByRole("note")).not.toHaveTextContent(/2026-/);
    fireEvent.click(screen.getByRole("button", { name: "Ver listas de trabalho" }));
    expect(await screen.findByRole("heading", { name: "Listas de trabalho" })).toBeInTheDocument();
  });

  it("does not show the Receita competence in the main content or in the query receipt", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/^Segmento/), { target: { value: "metal-mecanica" } });
    clickSearch();
    await screen.findByRole("table");
    expect(document.getElementById("app-content")?.querySelector(".runtime-base")).toBeNull();
    expect(document.querySelector(".receipt")?.textContent).not.toMatch(/base|2026-/);
    const badge = document.querySelector(".sidebar .runtime-base");
    expect(badge?.textContent).toContain("2026-07");
  });
});
