import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postBinary, SentinelApiError } from "./apiClient";

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
});
