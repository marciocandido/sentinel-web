import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoveryPage,
  establishment,
  commercialGroupPage,
  neighborSearchPage,
  radiusSearchPage,
  rootBranchesPage,
  similarCompanyPage,
} from "../test/fixtures";
import {
  searchEstablishmentsByRegion,
  searchEstablishmentsBySegment,
  searchEstablishmentsByRadius,
  searchNeighboringEstablishments,
  searchSimilarCompanies,
  searchCommercialGroup,
  searchRootBranches,
  createFeedbackEvent,
  listFeedbackEvents,
  exportDiscoveryResults,
  createSavedSearch,
  listSavedSearches,
  deleteSavedSearch,
} from "./sentinelApi";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function exportResponse(
  format: "CSV" | "XLSX",
  filename: string,
  contentType?: string,
): Response {
  const blob = new Blob([format]);
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "Content-Type": contentType ?? (format === "CSV"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      "Content-Disposition": `attachment; filename="${filename}"`,
    }),
    blob: () => Promise.resolve(blob),
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(discoveryPage()));
  vi.stubGlobal("fetch", fetchMock);
});

describe("saved searches", () => {
  const saved = (search: unknown) => ({ saved_search_id: "2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498", name: "Pesquisa", search, created_at: "2026-08-13T12:00:00Z" });
  const page = (items: unknown[]) => ({ items, pagination: { limit: 20, offset: 0, returned: items.length, has_more: false } });
  it("creates, lists and deletes canonical payloads without actor_id", async () => {
    const canonical = { kind:"SIMILAR" as const, cnpj_full:"00ABC", uf:null, codigo_tom:null, segment_id:null, radius_km:null, include_discarded:false };
    fetchMock.mockResolvedValueOnce(jsonResponse(saved(canonical), 201));
    await createSavedSearch({ name:" Pesquisa ", search:canonical });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/discovery/saved-searches");
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ name:" Pesquisa ", search:canonical }));
    fetchMock.mockResolvedValueOnce(jsonResponse(page([saved({ kind:"ROOT_BRANCHES", cnpj:"00ABC", cnpj_root:"00123456", include_discarded:false })])));
    await expect(listSavedSearches({ limit:20, offset:0 })).resolves.toMatchObject({ items:[{ search:{ kind:"ROOT_BRANCHES" } }] });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/discovery/saved-searches?limit=20&offset=0");
    fetchMock.mockResolvedValueOnce({ ok:true,status:204,json:vi.fn() } as unknown as Response);
    await deleteSavedSearch("2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498");
    expect(fetchMock.mock.calls[2][0]).toContain("2b5b4d78-7a65-4ba8-b12b-1c3cb0fd5498");
  });
  it("rejects malformed or extra saved search fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([saved({ kind:"SEGMENT", segment_id:"metal", actor_id:"browser" })])));
    await expect(listSavedSearches({ limit:20, offset:0 })).rejects.toMatchObject({ code:"invalid_response" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ items:[], pagination:{ limit:20, offset:0, returned:0, has_more:false, total:0 } }));
    await expect(listSavedSearches({ limit:20, offset:0 })).rejects.toMatchObject({ code:"invalid_response" });
  });
});

describe("Sentinel Discovery API", () => {
  it("mounts the segment route, starts at offset zero and omits empty filters", async () => {
    await searchEstablishmentsBySegment({
      segmentId: "metal/mecanica",
      uf: " ",
      codigoTom: "",
      porteCodigo: "",
      capitalMin: "",
      capitalMax: "",
      limit: 50,
      offset: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/discovery/segments/metal%2Fmecanica/establishments?limit=50&offset=0",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends every supported segment filter without coercing text", async () => {
    await searchEstablishmentsBySegment({
      segmentId: "metal-mecanica",
      uf: " SP ",
      codigoTom: "0012",
      porteCodigo: "03",
      capitalMin: "000100.50",
      capitalMax: "900000.00",
      limit: 25,
      offset: 50,
    });
    const url = new URL(fetchMock.mock.calls[0][0], "http://sentinel.local");
    expect(url.pathname).toBe("/api/v1/discovery/segments/metal-mecanica/establishments");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "25",
      offset: "50",
      uf: "SP",
      codigo_tom: "0012",
      porte_codigo: "03",
      capital_min: "000100.50",
      capital_max: "900000.00",
    });
  });

  it("mounts the region route with all supported filters", async () => {
    await searchEstablishmentsByRegion({
      uf: "SP",
      codigoTom: "0012",
      codigoIbge: "03550308",
      municipioNome: "SAO PAULO",
      segmentId: "metal-mecanica",
      limit: 100,
      offset: 0,
    });
    const url = new URL(fetchMock.mock.calls[0][0], "http://sentinel.local");
    expect(url.pathname).toBe("/api/v1/discovery/regions/establishments");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "100",
      offset: "0",
      uf: "SP",
      codigo_tom: "0012",
      codigo_ibge: "03550308",
      municipio_nome: "SAO PAULO",
      segment_id: "metal-mecanica",
    });
  });

  it("preserves numeric and alphanumeric identifiers and nullable strings", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(discoveryPage([
      establishment({ cnpj_full: "00123456000195", codigo_tom: "0012", codigo_ibge: "03550308", cnae_principal: "02511000" }),
      establishment({ cnpj_full: "12AB345600019X", cnpj_root: "12AB3456", nome_fantasia: null }),
    ])));
    const page = await searchEstablishmentsByRegion({ uf: "SP", limit: 50, offset: 0 });
    expect(page.items[0]).toMatchObject({
      cnpj_full: "00123456000195",
      codigo_tom: "0012",
      codigo_ibge: "03550308",
      cnae_principal: "02511000",
    });
    expect(page.items[1]).toMatchObject({ cnpj_full: "12AB345600019X", cnpj_root: "12AB3456", nome_fantasia: null });
  });

  it("rejects a malformed discovery response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ cnpj_full: 123 }], pagination: {} }));
    await expect(searchEstablishmentsByRegion({ uf: "SP", limit: 50, offset: 0 })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("builds a radius request without coercing textual identifiers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(radiusSearchPage()));
    await searchEstablishmentsByRadius({ origin: { kind: "tom", codigoTom: "0012" }, radiusKm: 5, resultUf: "SP", limit: 25, offset: 50 });
    const url = new URL(fetchMock.mock.calls[0][0], "http://local");
    expect(url.pathname).toBe("/api/v1/discovery/radius/establishments");
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "25", offset: "50", radius_km: "5", origin_codigo_tom: "0012", uf: "SP" });
  });

  it("rejects a malformed radius HTTP 200 response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ origin: {}, items: [], pagination: {} }));
    await expect(searchEstablishmentsByRadius({ origin: { kind: "cnpj", cnpj: "00ABC" }, radiusKm: 1, limit: 50, offset: 0 })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("builds the root-branches route with exactly one textual identifier", async () => {
    fetchMock.mockResolvedValue(jsonResponse(rootBranchesPage()));
    await searchRootBranches({
      identifier: { kind: "cnpj", cnpj: "00.ABC/234 0001-55" },
      limit: 25,
      offset: 50,
    });
    await searchRootBranches({
      identifier: { kind: "root", cnpjRoot: "00123456" },
      limit: 100,
      offset: 0,
    });

    const cnpjUrl = new URL(fetchMock.mock.calls[0][0], "http://local");
    const rootUrl = new URL(fetchMock.mock.calls[1][0], "http://local");
    expect(cnpjUrl.pathname).toBe("/api/v1/discovery/root-branches");
    expect(Object.fromEntries(cnpjUrl.searchParams)).toEqual({
      limit: "25",
      offset: "50",
      cnpj: "00.ABC/234 0001-55",
    });
    expect(cnpjUrl.search).toContain("%2F");
    expect(cnpjUrl.searchParams.has("cnpj_root")).toBe(false);
    expect(Object.fromEntries(rootUrl.searchParams)).toEqual({
      limit: "100",
      offset: "0",
      cnpj_root: "00123456",
    });
    expect(rootUrl.searchParams.has("cnpj")).toBe(false);
  });

  it("rejects a malformed root-branches HTTP 200 response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ root: {}, items: [], pagination: {} }),
    );
    await expect(
      searchRootBranches({
        identifier: { kind: "root", cnpjRoot: "00123456" },
        limit: 50,
        offset: 0,
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("builds the commercial-group route with encoded text and pagination", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(commercialGroupPage()));
    await searchCommercialGroup({
      groupId: "grupo metal/01 & A",
      limit: 25,
      offset: 50,
    });

    const url = new URL(fetchMock.mock.calls[0][0], "http://local");
    expect(url.pathname).toBe("/api/v1/discovery/commercial-groups");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "25",
      offset: "50",
      group_id: "grupo metal/01 & A",
    });
    expect(url.search).toContain("%2F");
  });

  it("rejects a malformed commercial-group HTTP 200 response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ group: {}, items: [], pagination: {} }),
    );
    await expect(
      searchCommercialGroup({ groupId: "grupo-metal", limit: 50, offset: 0 }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([false, undefined])(
    "omits include_discarded and actor_id from all seven operations when visibility is %s",
    async (includeDiscarded) => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(discoveryPage()))
        .mockResolvedValueOnce(jsonResponse(discoveryPage()))
        .mockResolvedValueOnce(jsonResponse(radiusSearchPage()))
        .mockResolvedValueOnce(jsonResponse(neighborSearchPage()))
        .mockResolvedValueOnce(jsonResponse(rootBranchesPage()))
        .mockResolvedValueOnce(jsonResponse(commercialGroupPage()))
        .mockResolvedValueOnce(jsonResponse(similarCompanyPage()));
      await searchEstablishmentsBySegment({ segmentId: "metal", includeDiscarded, limit: 1, offset: 0 });
      await searchEstablishmentsByRegion({ uf: "PR", includeDiscarded, limit: 1, offset: 0 });
      await searchEstablishmentsByRadius({ origin: { kind: "cnpj", cnpj: "00ABC" }, radiusKm: 1, includeDiscarded, limit: 1, offset: 0 });
      await searchNeighboringEstablishments({ cnpjFull: "00ABC", radiusKm: 1, includeDiscarded, limit: 1, offset: 0 });
      await searchRootBranches({ identifier: { kind: "cnpj", cnpj: "00ABC" }, includeDiscarded, limit: 1, offset: 0 });
      await searchCommercialGroup({ groupId: "grupo", includeDiscarded, limit: 1, offset: 0 });
      await searchSimilarCompanies({ cnpjFull: "00ABC", includeDiscarded, limit: 1, offset: 0 });

      for (const [input] of fetchMock.mock.calls) {
        const url = new URL(input.toString(), "http://sentinel.local");
        expect(url.searchParams.has("include_discarded")).toBe(false);
        expect(url.searchParams.has("actor_id")).toBe(false);
      }
    },
  );

  it("sends include_discarded=true, and never actor_id, in all seven operations", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(discoveryPage()))
      .mockResolvedValueOnce(jsonResponse(discoveryPage()))
      .mockResolvedValueOnce(jsonResponse(radiusSearchPage()))
      .mockResolvedValueOnce(jsonResponse(neighborSearchPage()))
      .mockResolvedValueOnce(jsonResponse(rootBranchesPage()))
      .mockResolvedValueOnce(jsonResponse(commercialGroupPage()))
      .mockResolvedValueOnce(jsonResponse(similarCompanyPage()));
    await searchEstablishmentsBySegment({ segmentId: "metal", includeDiscarded: true, limit: 1, offset: 0 });
    await searchEstablishmentsByRegion({ uf: "PR", includeDiscarded: true, limit: 1, offset: 0 });
    await searchEstablishmentsByRadius({ origin: { kind: "cnpj", cnpj: "00ABC" }, radiusKm: 1, includeDiscarded: true, limit: 1, offset: 0 });
    await searchNeighboringEstablishments({ cnpjFull: "00ABC", radiusKm: 1, includeDiscarded: true, limit: 1, offset: 0 });
    await searchRootBranches({ identifier: { kind: "cnpj", cnpj: "00ABC" }, includeDiscarded: true, limit: 1, offset: 0 });
    await searchCommercialGroup({ groupId: "grupo", includeDiscarded: true, limit: 1, offset: 0 });
    await searchSimilarCompanies({ cnpjFull: "00ABC", includeDiscarded: true, limit: 1, offset: 0 });

    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(input.toString(), "http://sentinel.local");
      expect(url.searchParams.getAll("include_discarded")).toEqual(["true"]);
      expect(url.searchParams.has("actor_id")).toBe(false);
    }
  });
});

describe("Sentinel Discovery export API", () => {
  it("posts only the CSV request and accepts its safe server filename", async () => {
    fetchMock.mockResolvedValueOnce(exportResponse(
      "CSV",
      "sentinel-segment-20260812T015500Z.csv",
    ));
    const request = {
      format: "CSV",
      search: {
        kind: "SEGMENT",
        segment_id: "0123456",
        codigo_tom: "0001",
      },
    } as const;
    const file = await exportDiscoveryResults(request);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/discovery/exports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
    expect(file).toMatchObject({
      format: "CSV",
      filename: "sentinel-segment-20260812T015500Z.csv",
    });
  });

  it("accepts XLSX and validates MIME, disposition and filename", async () => {
    fetchMock.mockResolvedValueOnce(exportResponse(
      "XLSX",
      "sentinel-root_branches-20260812T015500Z.xlsx",
    ));
    await expect(exportDiscoveryResults({
      format: "XLSX",
      search: { kind: "ROOT_BRANCHES", cnpj_root: "00123456" },
    })).resolves.toMatchObject({
      format: "XLSX",
      filename: "sentinel-root_branches-20260812T015500Z.xlsx",
    });

    fetchMock.mockResolvedValueOnce(exportResponse(
      "CSV",
      "sentinel-segment-20260812T015500Z.csv",
      "application/octet-stream",
    ));
    await expect(exportDiscoveryResults({
      format: "CSV",
      search: { kind: "SEGMENT", segment_id: "metal" },
    })).rejects.toMatchObject({ code: "invalid_response" });

    const missingDisposition = exportResponse("CSV", "ignored.csv");
    missingDisposition.headers.delete("Content-Disposition");
    fetchMock.mockResolvedValueOnce(missingDisposition);
    await expect(exportDiscoveryResults({
      format: "CSV",
      search: { kind: "SEGMENT", segment_id: "metal" },
    })).rejects.toMatchObject({ code: "invalid_response" });

    const missingFilename = exportResponse("CSV", "ignored.csv");
    missingFilename.headers.set("Content-Disposition", "attachment");
    fetchMock.mockResolvedValueOnce(missingFilename);
    await expect(exportDiscoveryResults({
      format: "CSV",
      search: { kind: "SEGMENT", segment_id: "metal" },
    })).rejects.toMatchObject({ code: "invalid_response" });

    fetchMock.mockResolvedValueOnce(exportResponse("CSV", "../../private.csv"));
    await expect(exportDiscoveryResults({
      format: "CSV",
      search: { kind: "SEGMENT", segment_id: "metal" },
    })).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("Sentinel feedback API", () => {
  const event = {
    event_id: "9c3d2478-7db9-4b61-b9ea-2efdb88b14c7",
    cnpj_full: "00ABC/234 0001-55",
    action: "USEFUL",
    actor_id: "local-operator",
    source: { kind: "SEGMENT", reference: "metal-mecanica" },
    occurred_at: "2026-08-01T18:00:00Z",
  } as const;

  it("posts only action and source with encoded CNPJ and idempotency header, accepting 201 and 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ event, idempotent_replay: false }, 201));
    fetchMock.mockResolvedValueOnce(jsonResponse({ event, idempotent_replay: true }, 200));
    await createFeedbackEvent({ cnpjFull: event.cnpj_full, action: "USEFUL", source: event.source, idempotencyKey: "feedback-uuid-1" });
    await createFeedbackEvent({ cnpjFull: event.cnpj_full, action: "USEFUL", idempotencyKey: "feedback-uuid-2" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/feedback/establishments/00ABC%2F234%200001-55/events");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "feedback-uuid-1" }),
      body: JSON.stringify({ action: "USEFUL", source: event.source }),
    });
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ action: "USEFUL" }));
  });

  it("uses limit/offset and forwards the history AbortSignal", async () => {
    const controller = new AbortController();
    let resolveRequest: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    const request = listFeedbackEvents({ cnpjFull: event.cnpj_full, limit: 20, offset: 40 }, { signal: controller.signal });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/feedback/establishments/00ABC%2F234%200001-55/events?limit=20&offset=40");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", signal: expect.any(AbortSignal) });
    controller.abort();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    resolveRequest?.(jsonResponse({
      cnpj_full: event.cnpj_full,
      actor_id: event.actor_id,
      items: [event],
      pagination: { limit: 20, offset: 40, returned: 1, has_more: false },
    }));
    await request;
  });

  it("keeps a 409 as the public typed error and rejects malformed success responses", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "idempotency_conflict", message: "private" } }, 409));
    await expect(createFeedbackEvent({ cnpjFull: event.cnpj_full, action: "USEFUL", idempotencyKey: "feedback-uuid" })).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });
    fetchMock.mockResolvedValueOnce(jsonResponse({ event: { cnpj_full: event.cnpj_full }, idempotent_replay: false }, 201));
    await expect(createFeedbackEvent({ cnpjFull: event.cnpj_full, action: "USEFUL", idempotencyKey: "feedback-uuid" })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects history responses with incompatible source references", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      cnpj_full: event.cnpj_full,
      actor_id: event.actor_id,
      items: [{ ...event, source: { kind: "COMMERCIAL_GROUP", reference: "Grupo Metal" } }],
      pagination: { limit: 20, offset: 0, returned: 1, has_more: false },
    }));
    await expect(listFeedbackEvents({ cnpjFull: event.cnpj_full, limit: 20, offset: 0 })).rejects.toMatchObject({ code: "invalid_response" });
  });
});
