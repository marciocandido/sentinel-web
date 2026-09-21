import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { runtimeStatus } from "../test/runtimeFixtures";
import { discoveryPage, establishment, neighborSearchPage, radiusSearchPage } from "../test/fixtures";
import { UfSelect } from "./UfSelect";
import { UF_OPTIONS } from "./ufOptions";

vi.mock("../features/discovery/RadiusMap", () => ({
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
  if (url.includes("/neighbors")) return Promise.resolve(jsonResponse(neighborSearchPage()));
  if (url.includes("/radius/")) return Promise.resolve(jsonResponse(radiusSearchPage()));
  return Promise.resolve(jsonResponse(discoveryPage([establishment()])));
}

const searchUrls = () => fetchMock.mock.calls
  .map(([input]) => input.toString())
  .filter((url) => url.includes("/api/v1/discovery/"));

const lastQuery = () => new URL(searchUrls().at(-1) as string, "http://sentinel.local").searchParams;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("UfSelect", () => {
  it("offers the 27 federal units plus an empty option", async () => {
    render(<App />);
    const select = await screen.findByLabelText("UF");
    expect(select.tagName).toBe("SELECT");
    const options = Array.from((select as HTMLSelectElement).options);
    expect(options).toHaveLength(28);
    expect(options[0]).toHaveValue("");
    expect(options.slice(1).map((option) => option.value)).toEqual(UF_OPTIONS.map(([code]) => code));
    expect(UF_OPTIONS).toHaveLength(27);
    expect(new Set(UF_OPTIONS.map(([code]) => code)).size).toBe(27);
  });

  it("reports every federal unit and the empty option exactly as selected", () => {
    const onChange = vi.fn();
    render(<label htmlFor="uf-unit">UF<UfSelect id="uf-unit" value="" onChange={onChange} /></label>);
    const select = screen.getByLabelText("UF");
    for (const [code] of UF_OPTIONS) {
      fireEvent.change(select, { target: { value: code } });
      expect(onChange).toHaveBeenLastCalledWith(code);
    }
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(onChange).toHaveBeenCalledTimes(UF_OPTIONS.length + 1);
  });

  it("keeps a loaded value that is not in the list instead of dropping it", () => {
    render(<label htmlFor="uf-loaded">UF<UfSelect id="uf-loaded" value="sp" onChange={() => undefined} /></label>);
    const select = screen.getByLabelText("UF") as HTMLSelectElement;
    expect(select).toHaveValue("sp");
    expect(select.options).toHaveLength(29);
  });

  it("sends the selected sigla unchanged to the API", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "metal-mecanica" } });
    const select = screen.getByLabelText("UF");
    fireEvent.change(select, { target: { value: "SP" } });
    expect(select).toHaveValue("SP");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(1));
    expect(lastQuery().get("uf")).toBe("SP");

    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(2));
    expect(lastQuery().has("uf")).toBe(false);
  });

  it("covers the radius origin and result units", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("radio", { name: "Por raio" }));
    fireEvent.change(screen.getByLabelText("Nome do município"), { target: { value: "SAO PAULO" } });
    fireEvent.change(screen.getByLabelText("UF da origem"), { target: { value: "SP" } });
    fireEvent.change(screen.getByLabelText("Raio em quilômetros"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("UF dos resultados"), { target: { value: "MG" } });
    expect(screen.getByLabelText("UF da origem").tagName).toBe("SELECT");
    expect(screen.getByLabelText("UF dos resultados").tagName).toBe("SELECT");
    fireEvent.click(screen.getByRole("button", { name: "Buscar por raio" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(1));
    expect(lastQuery().get("origin_uf")).toBe("SP");
    expect(lastQuery().get("uf")).toBe("MG");
  });

  it("covers the neighbours result unit", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("radio", { name: "Por vizinhos" }));
    fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "00ABC234000155" } });
    fireEvent.change(screen.getByLabelText("Raio em quilômetros"), { target: { value: "5" } });
    const select = screen.getByLabelText("UF dos resultados — opcional");
    expect(select.tagName).toBe("SELECT");
    fireEvent.change(select, { target: { value: "RS" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar vizinhos" }));
    await waitFor(() => expect(searchUrls()).toHaveLength(1));
    expect(lastQuery().get("uf")).toBe("RS");
  });

  it("keeps the required origin validation instead of inventing a new rule", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("radio", { name: "Por raio" }));
    fireEvent.change(screen.getByLabelText("Nome do município"), { target: { value: "SAO PAULO" } });
    fireEvent.change(screen.getByLabelText("Raio em quilômetros"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar por raio" }));
    expect(await screen.findByText("Informe a UF da origem.")).toBeInTheDocument();
    expect(screen.getByLabelText("UF da origem")).toHaveAttribute("aria-invalid", "true");
    expect(searchUrls()).toHaveLength(0);
  });
});
