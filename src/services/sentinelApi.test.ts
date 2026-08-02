import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoveryPage,
  establishment,
  commercialGroupPage,
  radiusSearchPage,
  rootBranchesPage,
} from "../test/fixtures";
import {
  searchEstablishmentsByRegion,
  searchEstablishmentsBySegment,
  searchEstablishmentsByRadius,
  searchCommercialGroup,
  searchRootBranches,
  createFeedbackEvent,
  listFeedbackEvents,
} from "./sentinelApi";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(discoveryPage()));
  vi.stubGlobal("fetch", fetchMock);
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
