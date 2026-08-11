import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { neighborEstablishment, neighborSearchPage } from "../../test/fixtures";
import { isNeighborSearchPage } from "../../types/api";
import { createNeighborsSnapshot, validateNeighbors } from "./neighborsUtils";

vi.mock("./RadiusMap", () => ({
  RadiusMap: ({ accessibleName }: { accessibleName?: string }) => (
    <div role="region" aria-label={accessibleName} />
  ),
}));

const fetchMock = vi.fn();
const runtime = runtimeStatus();
const response = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes("/api/v1/runtime/status")) return Promise.resolve(response(runtime));
    if (url.includes("health/live")) return Promise.resolve(response({ status: "ok", service: "sentinel-api" }));
    if (url.includes("catalog/segments")) return Promise.resolve(response({ items: [{ id: "metal", name: "Metal" }] }));
    return Promise.resolve(response(neighborSearchPage()));
  });
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => input.toString().includes("/api/v1/runtime/status") ? Promise.resolve(response(runtime)) : fetchMock(input, init));
});

describe("vizinhos", () => {
  it("validates CNPJ as text and snapshots the submitted filters", () => {
    expect(validateNeighbors({ cnpj: "", radiusKm: "30", segmentId: "", resultUf: "" }).cnpj).toBeTruthy();
    expect(validateNeighbors({ cnpj: "00.ABC/0001-55", radiusKm: "Infinity", segmentId: "", resultUf: "" }).radiusKm).toBeTruthy();
    expect(createNeighborsSnapshot({ cnpj: " 00.ABC/0001-55 ", radiusKm: "30", segmentId: " metal ", resultUf: " SP " })).toEqual({ cnpj: "00.ABC/0001-55", radiusKm: 30, segmentId: "metal", resultUf: "SP" });
  });

  it("uses the CNPJ-specific endpoint, preserves order, and omits domain fields not in the contract", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/api/v1/runtime/status")) return Promise.resolve(response(runtime));
      if (url.includes("health/live")) return Promise.resolve(response({ status: "ok", service: "sentinel-api" }));
      if (url.includes("catalog/segments")) return Promise.resolve(response({ items: [] }));
      return Promise.resolve(response(neighborSearchPage([neighborEstablishment({ razao_social: "PRIMEIRA" }), neighborEstablishment({ cnpj_full: "0002", razao_social: "SEGUNDA" })])));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("radio", { name: "Por vizinhos" }));
    fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "00.ABC/0001-55" } });
    fireEvent.change(screen.getByLabelText("Raio em quilômetros"), { target: { value: "15" } });
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de busca por vizinhos" }));
    await screen.findByText("PRIMEIRA");
    const url = new URL(fetchMock.mock.calls.find(([input]) => input.toString().includes("/neighbors"))![0], "http://local");
    expect(url.pathname).toBe("/api/v1/discovery/establishments/00.ABC%2F0001-55/neighbors");
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "50", offset: "0", radius_km: "15" });
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("PRIMEIRA");
    expect(rows[2]).toHaveTextContent("SEGUNDA");
    expect(screen.queryByText(/porte|capital|prospect/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mapa dos estabelecimentos vizinhos" })).toBeInTheDocument();
  });

  it("rejects a malformed neighbor page without accepting coercions or commercial values", () => {
    const valid = neighborSearchPage();
    expect(isNeighborSearchPage(valid)).toBe(true);
    expect(isNeighborSearchPage({ ...valid, items: [{ ...valid.items[0], distance_km: -1 }] })).toBe(false);
    expect(isNeighborSearchPage({ ...valid, items: [{ ...valid.items[0], has_geo: 1 }] })).toBe(false);
    expect(isNeighborSearchPage({ ...valid, items: [{ ...valid.items[0], commercial_status: "CLIENT" }] })).toBe(false);
    expect(isNeighborSearchPage({ ...valid, origin: { ...valid.origin, kind: "MUNICIPALITY" } })).toBe(false);
  });

  it("uses the submitted snapshot for pagination after form edits", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("health/live")) return Promise.resolve(response({ status: "ok", service: "sentinel-api" }));
      if (url.includes("catalog/segments")) return Promise.resolve(response({ items: [] }));
      const parsed = new URL(url, "http://local");
      return Promise.resolve(response(neighborSearchPage(undefined, { offset: Number(parsed.searchParams.get("offset")), has_more: Number(parsed.searchParams.get("offset")) === 0 })));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("radio", { name: "Por vizinhos" }));
    fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "001" } });
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de busca por vizinhos" }));
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "002" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => input.toString().includes("/neighbors"))).toHaveLength(2));
    expect(fetchMock.mock.calls.filter(([input]) => input.toString().includes("/neighbors"))[1][0]).toContain("/001/neighbors");
  });
});
