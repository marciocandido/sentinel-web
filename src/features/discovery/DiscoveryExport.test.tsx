import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import {
  commercialGroupPage,
  discoveryPage,
  establishment,
  neighborSearchPage,
  radiusSearchPage,
  rootBranchesPage,
  similarCompanyPage,
} from "../../test/fixtures";
import { runtimeStatus } from "../../test/runtimeFixtures";

vi.mock("./RadiusMap", () => ({
  RadiusMap: ({ accessibleName = "Mapa dos resultados por raio" }: { accessibleName?: string }) => (
    <div role="img" aria-label={accessibleName} />
  ),
}));

const fetchMock = vi.fn();
const runtime = runtimeStatus();
const catalog = { items: [{ id: "0123456", name: "Metal-mecânica" }] };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => Promise.resolve(body),
  } as Response;
}

function binaryResponse(kind: string, format: "CSV" | "XLSX" = "CSV"): Response {
  const extension = format === "CSV" ? "csv" : "xlsx";
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "Content-Type": format === "CSV"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sentinel-${kind.toLowerCase()}-20260812T015500Z.${extension}"`,
    }),
    blob: () => Promise.resolve(new Blob([kind])),
  } as Response;
}

function defaultApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = input.toString();
  if (url.includes("/api/v1/runtime/status")) return Promise.resolve(jsonResponse(runtime));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  if (url.endsWith("/api/v1/discovery/exports") && init?.method === "POST") {
    const request = JSON.parse(init.body as string) as { format: "CSV" | "XLSX"; search: { kind: string } };
    return Promise.resolve(binaryResponse(request.search.kind, request.format));
  }
  if (url.includes("/similar?")) return Promise.resolve(jsonResponse(similarCompanyPage()));
  if (url.includes("/radius/establishments?")) return Promise.resolve(jsonResponse(radiusSearchPage()));
  if (url.includes("/neighbors?")) return Promise.resolve(jsonResponse(neighborSearchPage()));
  if (url.includes("/root-branches?")) return Promise.resolve(jsonResponse(rootBranchesPage()));
  if (url.includes("/commercial-groups?")) return Promise.resolve(jsonResponse(commercialGroupPage()));
  return Promise.resolve(jsonResponse(discoveryPage([establishment()], { has_more: true })));
}

function exportRequests() {
  return fetchMock.mock.calls
    .filter(([input, init]) => input.toString().endsWith("/api/v1/discovery/exports") && init?.method === "POST")
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

async function submitMode(mode: "segment" | "region" | "radius" | "neighbors" | "root" | "group") {
  if (mode !== "segment") {
    const labels = {
      region: "Por região",
      radius: "Por raio",
      neighbors: "Por vizinhos",
      root: "Por raiz/filiais",
      group: "Por grupo",
    } as const;
    fireEvent.click(await screen.findByRole("radio", { name: labels[mode] }));
  }
  if (mode === "segment") {
    fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "0123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  } else if (mode === "region") {
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "PR" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  } else if (mode === "radius") {
    fireEvent.change(screen.getByLabelText("Nome do município"), { target: { value: "CURITIBA" } });
    fireEvent.change(screen.getByLabelText("UF da origem"), { target: { value: "PR" } });
    fireEvent.change(screen.getByLabelText("Raio em quilômetros"), { target: { value: "12.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar por raio" }));
  } else if (mode === "neighbors") {
    fireEvent.change(screen.getByLabelText("CNPJ de referência"), { target: { value: "00ABC123000100" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar vizinhos" }));
  } else if (mode === "root") {
    fireEvent.change(screen.getByRole("textbox", { name: "CNPJ completo" }), { target: { value: "00ABC123000100" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar raiz e filiais" }));
  } else {
    fireEvent.change(screen.getByLabelText("ID do grupo"), { target: { value: "grupo-001" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar grupo" }));
  }
  await screen.findByRole("button", { name: "Exportar CSV" });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sentinel-export");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("Discovery export UI", () => {
  it.each([
    ["segment", "SEGMENT"],
    ["region", "REGION"],
    ["radius", "RADIUS"],
    ["neighbors", "NEIGHBORS"],
    ["root", "ROOT_BRANCHES"],
    ["group", "COMMERCIAL_GROUP"],
  ] as const)("exports the submitted %s context without pagination", async (mode, kind) => {
    render(<App />);
    await submitMode(mode);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(exportRequests()).toHaveLength(1));
    const request = exportRequests()[0];
    expect(request.format).toBe("CSV");
    expect(request.search.kind).toBe(kind);
    expect(request.search).not.toHaveProperty("limit");
    expect(request.search).not.toHaveProperty("offset");
    expect(await screen.findByText("Arquivo preparado para download.")).toBeInTheDocument();
  });

  it("uses the submitted snapshot after form edits and visible pagination changes", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/Segmento/), { target: { value: "0123456" } });
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "PR" } });
    fireEvent.change(screen.getByLabelText("Código TOM"), { target: { value: "0001" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("button", { name: "Exportar CSV" });
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SC" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar Excel" }));
    await waitFor(() => expect(exportRequests()).toHaveLength(1));
    expect(exportRequests()[0]).toEqual({
      format: "XLSX",
      search: {
        kind: "SEGMENT",
        segment_id: "0123456",
        uf: "PR",
        codigo_tom: "0001",
      },
    });
  });

  it("keeps results on a safe export error and aborts export on a new search", async () => {
    let exportSignal: AbortSignal | undefined;
    let exportAttempts = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!input.toString().endsWith("/api/v1/discovery/exports")) return defaultApi(input, init);
      exportAttempts += 1;
      if (exportAttempts === 1) {
        return Promise.resolve(jsonResponse({
          error: { code: "export_too_large", message: "private backend detail" },
        }, 422));
      }
      exportSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("private", "AbortError")));
      });
    });
    render(<App />);
    await submitMode("segment");
    await screen.findByText("EMPRESA EXEMPLO LTDA");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("filtros mais restritivos");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByText("EMPRESA EXEMPLO LTDA")).toBeInTheDocument();
    expect(screen.queryByText("private backend detail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exportar Excel" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Preparando arquivo Excel");
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(exportSignal?.aborted).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByText(/cancelad/i)).not.toBeInTheDocument();
  });

  it("exports similar companies from the drawer using only the textual reference", async () => {
    render(<App />);
    await submitMode("segment");
    fireEvent.click((await screen.findAllByRole("button", { name: "Ver detalhes" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver semelhantes" }));
    await screen.findByText("EMPRESA SEMELHANTE LTDA");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar Excel" }));
    await waitFor(() => expect(exportRequests()).toHaveLength(1));
    expect(exportRequests()[0]).toEqual({
      format: "XLSX",
      search: { kind: "SIMILAR", cnpj_full: "00123456000195" },
    });
  });
});
