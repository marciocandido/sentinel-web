import { createRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  radiusSearchEstablishment,
  rootBranchEstablishment,
} from "../../test/fixtures";
import { CommercialGroupTable } from "./CommercialGroupTable";
import { CommercialGroupResults } from "./CommercialGroupResults";
import { DiscoveryResults } from "./DiscoveryResults";
import { DiscoveryTable } from "./DiscoveryTable";
import { NeighborsTable } from "./NeighborsTable";
import { RadiusTable } from "./RadiusTable";
import { RootBranchesTable } from "./RootBranchesTable";

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
    render(
      <CommercialGroupResults
        state={{ kind: "success", page: groupPage, snapshot: { groupId: "Grupo Metal" } }}
        focusRef={createRef()}
        onRetry={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onLimitChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    await screen.findByText("Feedback registrado com sucesso.");
    const groupPost = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(groupPost?.[1].body as string)).toEqual({
      action: "USEFUL",
      source: { kind: "COMMERCIAL_GROUP", reference: null },
    });

    cleanup();
    fetchMock.mockClear();
    render(
      <DiscoveryResults
        state={{
          kind: "success",
          page: discoveryPage([establishment()]),
          snapshot: {
            mode: "segment",
            segmentId: "Grupo Metal",
            uf: "",
            codigoTom: "",
            porteCodigo: "",
            capitalMin: "",
            capitalMax: "",
          },
        }}
        onRetry={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onLimitChange={vi.fn()}
        onSelectEstablishment={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Feedback" }).at(-1)!);
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getAllByRole("button", { name: "Útil" }).at(-1)!);
    await screen.findByText("Feedback registrado com sucesso.");
    const segmentPost = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(segmentPost?.[1].body as string)).toEqual({
      action: "USEFUL",
      source: { kind: "SEGMENT", reference: null },
    });
  });

  it("exposes feedback for radius, neighbors, root branches and known commercial-group establishments only", () => {
    render(<>
      <RadiusTable items={[radiusSearchEstablishment()]} onSelect={vi.fn()} feedbackSource={{ kind: "RADIUS", reference: null }} />
      <NeighborsTable items={[neighborEstablishment()]} feedbackSource={{ kind: "NEIGHBORS", reference: "00ABC234000155" }} />
      <RootBranchesTable items={[rootBranchEstablishment()]} onSelect={vi.fn()} feedbackSource={{ kind: "ROOT_BRANCHES", reference: "00123456" }} />
      <CommercialGroupTable items={[commercialGroupKnownEstablishment(), commercialGroupUnknownRoot()]} onSelect={vi.fn()} feedbackSource={{ kind: "COMMERCIAL_GROUP", reference: "grupo-metal" }} />
    </>);
    expect(screen.getAllByRole("button", { name: "Feedback" })).toHaveLength(4);
    expect(screen.getByText("Estabelecimento não disponível na base útil").closest("tr")).not.toHaveTextContent("Feedback");
  });

  it("opens one accessible panel at a time, loads history and closes on its row button", async () => {
    render(<DiscoveryTable
      items={[establishment({ cnpj_full: "00123456000195", razao_social: "PRIMEIRA" }), establishment({ cnpj_full: "00123456000196", razao_social: "SEGUNDA" })]}
      onSelectEstablishment={vi.fn()}
      feedbackSource={{ kind: "SEGMENT", reference: "metal-mecanica" }}
    />);
    const buttons = screen.getAllByRole("button", { name: "Feedback" });
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
    render(<DiscoveryTable items={[establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]} onSelectEstablishment={vi.fn()} feedbackSource={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
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
      body: JSON.stringify({ action: "USEFUL", source }),
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
    render(<DiscoveryTable items={[establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]} onSelectEstablishment={vi.fn()} feedbackSource={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
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
    render(<DiscoveryTable items={[establishment({ cnpj_full: event.cnpj_full, razao_social: "PRIMEIRA" })]} onSelectEstablishment={vi.fn()} feedbackSource={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    await screen.findByText("Ainda não há feedback registrado para este estabelecimento.");
    fireEvent.click(screen.getByRole("button", { name: "Útil" }));
    expect(await screen.findByRole("status", { name: "" })).toHaveTextContent("Registrando feedback");
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    resolvePost?.(response({ event, idempotent_replay: false }, 201));
    await screen.findByText("Feedback registrado com sucesso.");
  });
});
