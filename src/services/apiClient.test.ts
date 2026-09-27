import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abortProtectedRequests, deleteNoContent, getJson, postBinary, postJson, SentinelApiError, subscribeSessionEnd } from "./apiClient";
import { setCsrfCookie } from "../test/authFixtures";

const fetchMock = vi.fn();

function binaryResponse(
  status = 200,
  headers: Record<string, string> = {},
  blob = new Blob(["content"]),
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    blob: () => Promise.resolve(blob),
    json: () => Promise.reject(new SyntaxError("not json")),
  } as Response;
}

function pendingBodyResponse(
  status: number,
  signal: AbortSignal | null | undefined,
  reader: "blob" | "json",
  onStart: () => void,
): Response {
  const pendingRead = () => {
    onStart();
    return new Promise<never>((_resolve, reject) => {
      signal?.addEventListener(
        "abort",
        () => reject(new DOMException("private body detail", "AbortError")),
        { once: true },
      );
    });
  };
  return { ...binaryResponse(status), [reader]: pendingRead } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("postBinary", () => {
  it("posts JSON and returns binary headers while forwarding an AbortSignal", async () => {
    const blob = new Blob(["csv"]);
    fetchMock.mockResolvedValue(binaryResponse(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sentinel-segment-20260812T015500Z.csv"',
    }, blob));
    const external = new AbortController();
    const request = postBinary("/exports", { format: "CSV" }, {
      baseUrl: " https://api.example/ ",
      signal: external.signal,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example/exports");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ format: "CSV" }),
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const result = await request;
    expect(result).toEqual({
      blob,
      contentType: "text/csv; charset=utf-8",
      contentDisposition: 'attachment; filename="sentinel-segment-20260812T015500Z.csv"',
    });
  });

  it("propagates a valid backend error and sanitizes a non-JSON error", async () => {
    fetchMock.mockResolvedValueOnce({
      ...binaryResponse(422),
      json: () => Promise.resolve({ error: { code: "export_too_large", message: "private" } }),
    } as Response);
    await expect(postBinary("/exports", {})).rejects.toMatchObject({
      code: "export_too_large",
      status: 422,
    });
    fetchMock.mockResolvedValueOnce(binaryResponse(502));
    await expect(postBinary("/exports", {})).rejects.toMatchObject({
      code: "http_error",
      status: 502,
    });
  });

  it("maps timeout, external abort and network failures without private details", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_input, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("private", "AbortError")));
      }));
    const timedOut = postBinary("/exports", {}, { timeoutMs: 10 });
    const timedOutResult = expect(timedOut).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(10);
    await timedOutResult;

    vi.useRealTimers();
    const external = new AbortController();
    fetchMock.mockImplementationOnce((_input, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("private", "AbortError")));
      }));
    const aborted = postBinary("/exports", {}, { signal: external.signal });
    external.abort();
    await expect(aborted).rejects.toMatchObject({ code: "request_aborted" });

    fetchMock.mockRejectedValueOnce(new TypeError("private network"));
    await expect(postBinary("/exports", {})).rejects.toEqual(
      expect.objectContaining<Partial<SentinelApiError>>({ code: "network_error" }),
    );
  });

  it("preserves an external abort while reading a successful Blob", async () => {
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    fetchMock.mockImplementationOnce((_input, init?: RequestInit) => Promise.resolve(
      pendingBodyResponse(200, init?.signal, "blob", bodyStarted),
    ));
    const external = new AbortController();

    const request = postBinary("/exports", {}, { signal: external.signal });
    await started;
    external.abort();

    await expect(request).rejects.toMatchObject({ code: "request_aborted" });
  });

  it("preserves a timeout while reading a successful Blob", async () => {
    vi.useFakeTimers();
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    fetchMock.mockImplementationOnce((_input, init?: RequestInit) => Promise.resolve(
      pendingBodyResponse(200, init?.signal, "blob", bodyStarted),
    ));

    const request = postBinary("/exports", {}, { timeoutMs: 10 });
    await started;
    const result = expect(request).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(10);
    await result;
  });

  it("maps a non-abort Blob read failure to a sanitized invalid response", async () => {
    fetchMock.mockResolvedValue({
      ...binaryResponse(),
      blob: () => Promise.reject(new Error("private body detail")),
    } as Response);

    await expect(postBinary("/exports", {})).rejects.toMatchObject({
      code: "invalid_response",
      status: 200,
      message: "A API retornou uma resposta que não pôde ser interpretada.",
    });
  });

  it("preserves an external abort while reading an error JSON body", async () => {
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    fetchMock.mockImplementationOnce((_input, init?: RequestInit) => Promise.resolve(
      pendingBodyResponse(422, init?.signal, "json", bodyStarted),
    ));
    const external = new AbortController();

    const request = postBinary("/exports", {}, { signal: external.signal });
    await started;
    external.abort();

    await expect(request).rejects.toMatchObject({ code: "request_aborted" });
  });

  it("preserves a timeout while reading an error JSON body", async () => {
    vi.useFakeTimers();
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    fetchMock.mockImplementationOnce((_input, init?: RequestInit) => Promise.resolve(
      pendingBodyResponse(500, init?.signal, "json", bodyStarted),
    ));

    const request = postBinary("/exports", {}, { timeoutMs: 10 });
    await started;
    const result = expect(request).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(10);
    await result;
  });
});

describe("deleteNoContent", () => {
  it("uses DELETE and accepts 204 without reading JSON", async () => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, status: 204, json } as unknown as Response);
    await deleteNoContent("/saved-searches/a", { baseUrl: "https://api.example/" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example/saved-searches/a", expect.objectContaining({ method: "DELETE" }));
    expect(json).not.toHaveBeenCalled();
  });
  it("preserves JSON codes and sanitizes unknown delete errors", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({ error: { code: "saved_search_not_found", message: "private" } }) } as Response);
    await expect(deleteNoContent("/x")).rejects.toMatchObject({ code: "saved_search_not_found", status: 404 });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.reject(new SyntaxError("private")) } as Response);
    await expect(deleteNoContent("/x")).rejects.toMatchObject({ code: "http_error", status: 500 });
  });
  it("maps external abort, timeout and network errors", async () => {
    const external = new AbortController();
    fetchMock.mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("private", "AbortError")))));
    const aborted = deleteNoContent("/x", { signal: external.signal }); external.abort();
    await expect(aborted).rejects.toMatchObject({ code: "request_aborted" });
    vi.useFakeTimers(); fetchMock.mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("private", "AbortError")))));
    const timed = deleteNoContent("/x", { timeoutMs: 10 }); const result = expect(timed).rejects.toMatchObject({ code: "request_timeout" }); await vi.advanceTimersByTimeAsync(10); await result;
    vi.useRealTimers(); fetchMock.mockRejectedValueOnce(new TypeError("private"));
    await expect(deleteNoContent("/x")).rejects.toMatchObject({ code: "network_error" });
  });
});

describe("CSRF, sessão e escopo protegido", () => {
  function jsonResponse(status: number, body: unknown): Response {
    return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: () => Promise.resolve(body) } as Response;
  }
  const errorBody = (code: string) => ({ error: { code, message: "private backend detail" } });
  const sentHeaders = (call = 0) => fetchMock.mock.calls[call][1].headers as Record<string, string>;

  it("envia o CSRF vigente em POST, DELETE e POST binário, descartando valor da feature", async () => {
    setCsrfCookie("current-token");
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    await postJson("/x", {}, { acceptedStatuses: [201], headers: { "x-sentinel-csrf": "forged", "Idempotency-Key": "k" } });
    expect(sentHeaders(0)["X-Sentinel-CSRF"]).toBe("current-token");
    expect(sentHeaders(0)["x-sentinel-csrf"]).toBeUndefined();
    expect(sentHeaders(0)["Idempotency-Key"]).toBe("k");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("same-origin");

    setCsrfCookie("rotated-token");
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
    await deleteNoContent("/x/1");
    expect(sentHeaders(1)["X-Sentinel-CSRF"]).toBe("rotated-token");

    fetchMock.mockResolvedValueOnce(binaryResponse(200));
    await postBinary("/exports", {});
    expect(sentHeaders(2)["X-Sentinel-CSRF"]).toBe("rotated-token");
  });

  it("não envia CSRF em GET", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await getJson("/x");
    expect(sentHeaders()).toEqual({ Accept: "application/json" });
    expect(fetchMock.mock.calls[0][1].credentials).toBe("same-origin");
  });

  it("falha antes da mutação quando não há cookie CSRF e encerra a sessão local", async () => {
    setCsrfCookie(null);
    const listener = vi.fn();
    const unsubscribe = subscribeSessionEnd(listener);
    await expect(postJson("/x", {})).rejects.toMatchObject({ code: "csrf_missing" });
    await expect(deleteNoContent("/x/1")).rejects.toMatchObject({ code: "csrf_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith("unauthenticated");
    unsubscribe();
  });

  it("usa X-Sentinel-CSRF: login somente no login, mesmo sem cookie", async () => {
    setCsrfCookie(null);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await postJson("/api/v1/auth/login", {}, { auth: "login", acceptedStatuses: [200] });
    expect(sentHeaders()["X-Sentinel-CSRF"]).toBe("login");
  });

  it("notifica fim de sessão para 401 de sessão e 403 access_disabled, não para 403 de operação", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionEnd(listener);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, errorBody("session_expired")));
    await expect(getJson("/x")).rejects.toMatchObject({ code: "session_expired", status: 401 });
    fetchMock.mockResolvedValueOnce(jsonResponse(401, errorBody("session_invalid")));
    await expect(getJson("/x")).rejects.toMatchObject({ code: "session_invalid" });
    fetchMock.mockResolvedValueOnce(jsonResponse(403, errorBody("access_disabled")));
    await expect(postJson("/x", {})).rejects.toMatchObject({ code: "access_disabled" });
    fetchMock.mockResolvedValueOnce(jsonResponse(403, errorBody("permission_denied")));
    await expect(getJson("/x")).rejects.toMatchObject({ code: "permission_denied" });
    fetchMock.mockResolvedValueOnce(jsonResponse(403, errorBody("csrf_invalid")));
    await expect(postJson("/x", {})).rejects.toMatchObject({ code: "csrf_invalid" });
    expect(listener.mock.calls).toEqual([["expired"], ["unauthenticated"], ["access_disabled"]]);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, errorBody("session_expired")));
    await expect(getJson("/api/v1/auth/session", { auth: "session" })).rejects.toMatchObject({ code: "session_expired" });
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("abortProtectedRequests cancela requests protegidas pendentes, mas não as de autenticação", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionEnd(listener);
    const pending: Array<(response: Response) => void> = [];
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      pending.push(resolve);
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const protectedRequest = getJson("/api/v1/discovery/x");
    const protectedMutation = postJson("/api/v1/discovery/y", {});
    const authRequest = postJson("/api/v1/auth/logout", {}, { auth: "logout", acceptedStatuses: [204] });
    abortProtectedRequests();
    await expect(protectedRequest).rejects.toMatchObject({ code: "request_aborted" });
    await expect(protectedMutation).rejects.toMatchObject({ code: "request_aborted" });
    pending[2](jsonResponse(204, null));
    await expect(authRequest).resolves.toBeNull();

    // Novas requests usam o novo escopo normalmente.
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(getJson("/api/v1/discovery/z")).resolves.toEqual({ ok: true });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
