import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { discoveryPage, establishment } from "../../test/fixtures";

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

  it("keeps the primary action labelled and the backend ordering note secondary", async () => {
    render(<App />);
    const action = await screen.findByRole("button", { name: "Buscar" });
    expect(action).toHaveClass("primary-button");
    expect(screen.getByText("Os resultados seguem a ordem definida pelo backend.")).toHaveClass("search-actions__note");
  });
});
