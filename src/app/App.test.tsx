import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { buildApiUrl, getJson } from "../services/apiClient";

const runtime = { observed_at: "2026-08-07T19:43:22Z", summary: "AVAILABLE", components: { api: { state: "AVAILABLE", schema_current: null, last_seen_at: null }, database: { state: "AVAILABLE", schema_current: true, last_seen_at: null }, worker: { state: "IDLE", schema_current: null, last_seen_at: null } }, base: { state: "READY", active_competence: "2026-07", available_competence: "2026-07", preparing_competence: null, action_required: null, current_stage: null, progress: null, last_failure_code: null, last_failure_message: null } } as const;
const processingRuntime = { ...runtime, summary: "INITIALIZING" as const, components: { ...runtime.components, worker: { ...runtime.components.worker, state: "RUNNING" as const } }, base: { ...runtime.base, state: "PROCESSING" as const, preparing_competence: "2099-01", current_stage: "BUILD_BASE_UTIL", progress: { phase: "PROCESSING", stage: "BUILD_BASE_UTIL" } } };
const catalog = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

function defaultApi(input: RequestInfo | URL): Promise<Response> {
  const url = input.toString();
  if (url.includes("/api/v1/runtime/status")) return Promise.resolve(jsonResponse(runtime));
  if (url.includes("/api/v1/catalog/segments")) return Promise.resolve(jsonResponse(catalog));
  return Promise.reject(new Error(`Unexpected request: ${url}`));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultApi);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Sentinel Web foundation", () => {
  it("renders the application shell and the Discovery navigation", async () => {
    render(<App />);
    expect(screen.getByText("Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Discovery Comercial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discovery" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Empresas/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Listas/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Administração/ })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Buscar" })).toBeEnabled();
    await waitFor(() => expect(screen.getByText("Sistema disponível")).toBeInTheDocument());
  });

  it("does not mount Discovery before the first runtime confirmation", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    render(<App />);
    expect(screen.getByText("Verificação pendente")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Verificando estado do Sentinel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar detalhes da saúde" }));
    expect(screen.getByText("API").parentElement).toHaveTextContent("APIVerificando");
    expect(screen.getByText("Banco").parentElement).toHaveTextContent("BancoVerificando");
    expect(screen.getByText("Worker").parentElement).toHaveTextContent("WorkerVerificando");
    expect(screen.queryByText("Indisponível")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("replaces initial verification with progress after the first processing confirmation", async () => {
    let resolveRuntime: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (input.toString().includes("/api/v1/runtime/status")) return new Promise<Response>((resolve) => { resolveRuntime = resolve; });
      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    render(<App />);
    expect(screen.getByText("Verificando estado do Sentinel")).toBeInTheDocument();
    await act(async () => resolveRuntime?.(jsonResponse(processingRuntime)));
    expect(await screen.findByText("Preparando base da Receita")).toBeInTheDocument();
    expect(screen.getByText("Construindo base útil")).toBeInTheDocument();
    expect(screen.queryByText("Verificando estado do Sentinel")).not.toBeInTheDocument();
    expect(screen.queryByText("Sistema indisponível")).not.toBeInTheDocument();
  });

  it("shows offline for HTTP and network failures without exposing a stack trace", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (input.toString().includes("/api/v1/runtime/status")) return Promise.resolve(jsonResponse({ error: { code: "unknown", message: "internal stack trace" } }, 500));
      return Promise.reject(new TypeError("network failed"));
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText("Sistema indisponível")).toBeInTheDocument());
    expect(screen.getByText("Não foi possível confirmar o estado da base")).toBeInTheDocument();
    expect(screen.queryByText(/network failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
  });

  it("shows offline when the liveness request fails at the network layer", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (input.toString().includes("/api/v1/runtime/status")) {
        return Promise.reject(new TypeError("network failed"));
      }
      return Promise.resolve(jsonResponse(catalog));
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText("Sistema indisponível")).toBeInTheDocument());
    expect(screen.queryByText(/network failed/i)).not.toBeInTheDocument();
  });

  it("populates the select and preserves the segment id as a string", async () => {
    render(<App />);
    const select = await screen.findByLabelText(/Segmento/);
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Metal-mecânica" })).toHaveValue("metal-mecanica");
    fireEvent.change(select, { target: { value: "metal-mecanica" } });
    expect(select).toHaveValue("metal-mecanica");
  });

  it("handles an empty catalog", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => Promise.resolve(input.toString().includes("/api/v1/runtime/status") ? jsonResponse(runtime) : jsonResponse({ items: [] })));
    render(<App />);
    expect(await screen.findByText("Nenhum segmento disponível.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Segmento/)).toBeDisabled();
  });

  it("shows a public database-unavailable catalog error and retries manually", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (input.toString().includes("/api/v1/runtime/status")) return Promise.resolve(jsonResponse(runtime));
      return Promise.resolve(jsonResponse({ error: { code: "database_unavailable", message: "PostgreSQL/PostGIS is not available" } }, 503));
    });
    render(<App />);
    expect(await screen.findByText(/banco do Sentinel está indisponível/)).toBeInTheDocument();
    const callsBeforeRetry = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry));
    expect(screen.queryByText(/PostgreSQL\/PostGIS/)).not.toBeInTheDocument();
  });

  it("handles malformed success responses", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => Promise.resolve(input.toString().includes("/api/v1/runtime/status") ? jsonResponse(runtime) : jsonResponse({ items: [{ id: 7 }] })));
    render(<App />);
    expect(await screen.findByText(/Resposta inválida da API/)).toBeInTheDocument();
  });

  it("does not call a Discovery search endpoint", async () => {
    render(<App />);
    await screen.findByLabelText(/Segmento/);
    const urls = fetchMock.mock.calls.map(([input]) => input.toString());
    expect(urls).toEqual(expect.arrayContaining(["/api/v1/runtime/status", "/api/v1/catalog/segments"]));
    expect(urls.some((url) => url.includes("/api/v1/discovery/"))).toBe(false);
  });

  it("opens the accessible mobile navigation drawer and returns focus on Escape", () => {
    render(<App />);
    const menu = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Navegação principal")).toHaveClass("sidebar--mobile-open");
    expect(document.getElementById("app-content")).toHaveAttribute("inert");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("normalizes base URLs and uses a relative URL when it is empty", () => {
    expect(buildApiUrl("/health/live", "http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000/health/live");
    expect(buildApiUrl("/health/live", " http://127.0.0.1:8000/// ")).toBe("http://127.0.0.1:8000/health/live");
    expect(buildApiUrl("/health/live", "")).toBe("/health/live");
  });

  it("classifies a timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const rejection = expect(getJson("/health/live", { timeoutMs: 10 })).rejects.toMatchObject({
      code: "request_timeout",
      status: null,
    });
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
  });

  it("aborts in-flight requests on unmount without a late UI update", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return new Promise<Response>((resolve) => { resolveRequest = resolve; });
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = render(<App />);
    unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await act(async () => resolveRequest?.(jsonResponse(runtime)));
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
