import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteNoContent, postBinary, SentinelApiError } from "./apiClient";

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
