import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEvent, FeedbackSource } from "../../types/api";
import { establishment } from "../../test/fixtures";
import {
  commercialGroupKnownEstablishment,
  commercialGroupUnknownRoot,
  commercialGroupContext,
  commercialGroupPage,
  discoveryPage,
  neighborEstablishment,
  neighborSearchPage,
  radiusSearchEstablishment,
  radiusSearchPage,
  rootBranchEstablishment,
  rootBranchesPage,
} from "../../test/fixtures";
import type { DiscoveryEstablishment } from "../../types/api";
import { EMPTY_FORM, type QueryResult } from "./discoveryTypes";
import { QueryResultView } from "./QueryResultView";

function renderResult(result: QueryResult) {
  return render(
    <QueryResultView
      result={result}
      narrow={false}
      onSelect={vi.fn()}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onLimitChange={vi.fn()}
    />,
  );
}

function renderFiltered(items: DiscoveryEstablishment[], segmentId = "metal-mecanica") {
  return renderResult({
    kind: "filtered",
    snapshot: { ...EMPTY_FORM, segmentId, includeDiscarded: false },
    page: discoveryPage(items),
  });
}

const FEEDBACK = /^Feedback/;

const fetchMock = vi.fn();
const source: FeedbackSource = { kind: "SEGMENT", reference: "metal-mecanica" };
const event: FeedbackEvent = {
  event_id: "9c3d2478-7db9-4b61-b9ea-2efdb88b14c7",
  cnpj_full: "00123456000195",
  action: "USEFUL",
  actor_id: "local-operator",
  source,
  occurred_at: "2026-08-01T18:00:00Z",
};

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

function history(items: FeedbackEvent[] = []) {
  return {
    cnpj_full: "00123456000195",
    actor_id: "local-operator",
    items,
    pagination: { limit: 20, offset: 0, returned: items.length, has_more: false },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return Promise.resolve(response({ event, idempotent_replay: false }, 201));
    return Promise.resolve(response(history()));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("new-key") });
});

afterEach(() => vi.unstubAllGlobals());

describe("FeedbackPanel in discovery tables", () => {
  it("omits incompatible group and segment references from POST bodies", async () => {
    const groupPage = commercialGroupPage(
      [commercialGroupKnownEstablishment()],
      {},
      commercialGroupContext({ group_id: "Grupo Metal" }),
    );
    renderResult({ kind: "group", page: groupPage, snapshot: { groupId: "Grupo Metal", includeDiscarded: false } });
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    await screen.findByText("Feedback registrado com sucesso.");
    const groupPost = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(groupPost?.[1].body as string)).toEqual({
      action: "USEFUL",
      source: { kind: "COMMERCIAL_GROUP", reference: null },
    });

  });

  async function postedSource(): Promise<unknown> {
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    await screen.findByText("Feedback registrado com sucesso.");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    return JSON.parse(post?.[1].body as string).source;
  }

  it.each([
    ["segment, municipality and porte", { segmentId: "metal-mecanica", municipioNome: "CAMPINAS", porteCodigo: "05" }],
    ["only segment_id", { segmentId: "metal-mecanica" }],
    ["municipality and capital, without segment", { municipioNome: "DIADEMA", capitalMin: "100000" }],
  ])("sends source null for FILTERED results with %s, never SEGMENT or REGION", async (_name, filters) => {
    renderResult({
      kind: "filtered",
      snapshot: { ...EMPTY_FORM, ...filters, includeDiscarded: false },
      page: discoveryPage([establishment()]),
    });
    const source = await postedSource();
    expect(source).toBeNull();
    const body = JSON.stringify(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1].body);
    expect(body).not.toMatch(/SEGMENT|REGION|FILTERED/);
  });

  it.each([
    ["RADIUS", () => renderResult({ kind: "radius", snapshot: { origin: { kind: "cnpj", cnpj: "00ABC234000155" }, radiusKm: 5, segmentId: "metal", resultUf: "", includeDiscarded: false }, page: radiusSearchPage([radiusSearchEstablishment()]) }), { kind: "RADIUS", reference: null }],
    ["NEIGHBORS", () => renderResult({ kind: "neighbors", snapshot: { cnpj: "00ABC234000155", radiusKm: 5, segmentId: "", resultUf: "", includeDiscarded: false }, page: neighborSearchPage([neighborEstablishment()]) }), { kind: "NEIGHBORS", reference: "00ABC234000155" }],
    ["ROOT_BRANCHES", () => renderResult({ kind: "root", snapshot: { identifier: { kind: "root", cnpjRoot: "00123456" }, includeDiscarded: false }, page: rootBranchesPage([rootBranchEstablishment()]) }), { kind: "ROOT_BRANCHES", reference: "00123456" }],
    ["COMMERCIAL_GROUP", () => renderResult({ kind: "group", snapshot: { groupId: "grupo-metal", includeDiscarded: false }, page: commercialGroupPage([commercialGroupKnownEstablishment()]) }), { kind: "COMMERCIAL_GROUP", reference: "grupo-metal" }],
  ] as const)("keeps the real %s feedback source", async (_kind, renderView, expected) => {
    renderView();
    expect(await postedSource()).toEqual(expected);
  });

  it("exposes feedback for radius, neighbors, root branches and known commercial-group establishments only", () => {
    const snapshot = { radiusKm: 5, segmentId: "", resultUf: "", includeDiscarded: false };
    renderResult({ kind: "radius", snapshot: { ...snapshot, origin: { kind: "cnpj", cnpj: "00ABC234000155" } }, page: radiusSearchPage([radiusSearchEstablishment()]) });
    renderResult({ kind: "neighbors", snapshot: { ...snapshot, cnpj: "00ABC234000155" }, page: neighborSearchPage([neighborEstablishment()]) });
    renderResult({ kind: "root", snapshot: { identifier: { kind: "root", cnpjRoot: "00123456" }, includeDiscarded: false }, page: rootBranchesPage([rootBranchEstablishment()]) });
    renderResult({ kind: "group", snapshot: { groupId: "grupo-metal", includeDiscarded: false }, page: commercialGroupPage([commercialGroupKnownEstablishment(), commercialGroupUnknownRoot()]) });
    expect(screen.getAllByRole("button", { name: FEEDBACK })).toHaveLength(4);
    expect(screen.getByText("Registrada no grupo, sem estabelecimento na base útil.").closest("tr")).not.toHaveTextContent("Feedback");
  });

  it("opens one accessible panel at a time, loads history and closes on its row button", async () => {
    renderFiltered([establishment({ cnpj_full: "00123456000195", razao_social: "PRIMEIRA" }), establishment({ cnpj_full: "00123456000196", razao_social: "SEGUNDA" })]);
    const buttons = screen.getAllByRole("button", { name: FEEDBACK });
    fireEvent.click(buttons[0]);
    const panel = await screen.findByRole("region", { name: "Feedback comercial de PRIMEIRA" });
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("id", expect.stringContaining("feedback-00123456000195"));
    expect(await screen.findByText("Ator provisório: local-operator")).toBeInTheDocument();
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Feedback comercial de PRIMEIRA" })).not.toBeInTheDocument());
    expect(await screen.findByRole("region", { name: "Feedback comercial de SEGUNDA" })).toBeInTheDocument();
  });

  it("shows all actions, keeps result rows unchanged and sends the source immediately", async () => {
    renderFiltered([establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]);
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    for (const label of ["Útil", "Descartar", "Já conheço", "Contato ruim", "Virou visita", "Virou orçamento", "Virou venda (informado)"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/não confirma venda ou pedido no ERP/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    await screen.findByText("Feedback registrado com sucesso.");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[1]).toMatchObject({
      headers: expect.objectContaining({ "Idempotency-Key": "feedback-new-key" }),
      body: JSON.stringify({ action: "USEFUL", source: null }),
    });
    expect(screen.getAllByText("PRIMEIRA")).toHaveLength(2);
  });

  it("retries a failed POST with the exact same idempotency key and disables actions while active", async () => {
    let postCalls = 0;
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(response(history()));
      postCalls += 1;
      return postCalls === 1
        ? Promise.reject(new TypeError("offline"))
        : Promise.resolve(response({ event, idempotent_replay: true }, 200));
    });
    renderFiltered([establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]);
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Feedback registrado com sucesso.");
    const keys = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => (init?.headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys).toEqual(["feedback-new-key", "feedback-new-key"]);
  });

  it("disables every action while one POST is active", async () => {
    let resolvePost: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => { resolvePost = resolve; })
        : Promise.resolve(response(history())),
    );
    renderFiltered([establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]);
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    expect(await screen.findByRole("status", { name: "" })).toHaveTextContent("Registrando feedback");
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    resolvePost?.(response({ event, idempotent_replay: false }, 201));
    await screen.findByText("Feedback registrado com sucesso.");
  });

  it("does not refresh history after a pending POST completes on a closed panel", async () => {
    let getCalls = 0;
    let postCalls = 0;
    let resolvePost: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postCalls += 1;
        return new Promise<Response>((resolve) => { resolvePost = resolve; });
      }
      getCalls += 1;
      return Promise.resolve(response(history(getCalls === 1 ? [] : [event])));
    });
    renderFiltered([establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]);

    const feedbackButton = screen.getByRole("button", { name: FEEDBACK });
    feedbackButton.focus();
    fireEvent.click(feedbackButton);
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    expect(getCalls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    expect(postCalls).toBe(1);
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();

    feedbackButton.focus();
    fireEvent.click(feedbackButton);
    expect(screen.queryByRole("region", { name: "Feedback comercial de PRIMEIRA" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(feedbackButton);

    await act(async () => {
      resolvePost?.(response({ event, idempotent_replay: false }, 201));
    });
    expect(postCalls).toBe(1);
    expect(getCalls).toBe(1);
    expect(screen.queryByRole("region", { name: "Feedback comercial de PRIMEIRA" })).not.toBeInTheDocument();

    fireEvent.click(feedbackButton);
    await waitFor(() => expect(getCalls).toBe(2));
    expect(await screen.findByRole("region", { name: "Feedback comercial de PRIMEIRA" })).toBeInTheDocument();
  });
});
