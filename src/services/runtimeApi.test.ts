import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBootstrapPreflight, getRuntimeStatus, getUpdatePreflight, startBootstrap, startMonthlyUpdate } from "./sentinelApi";
import { runtimeStatus } from "../test/runtimeFixtures";

const runtime = runtimeStatus();
const preflight = { source: "SERPRO_WEBDAV", competence: "2026-07", file_count: 2, shard_count: 1, download_bytes: 1, reusable_bytes: 0, remaining_download_bytes: 1, free_bytes: 2, workspace_estimate_bytes: null, database_ready: true, schema_current: true, worker_available: true, lock_available: true, blockers: [], can_start: true, observed_at: "2026-08-07T19:43:22Z" };
const updatePreflight = { source: "SERPRO_WEBDAV", active_competence: "2026-07", target_competence: "2026-08", file_count: 2, shard_count: 1, download_bytes: 1, reusable_bytes: 0, remaining_download_bytes: 1, free_bytes: 2, staging_estimate_bytes: null, database_ready: true, schema_current: true, worker_available: true, lock_available: true, conflict_with_job: false, blockers: [], can_start: true, observed_at: "2026-08-07T19:43:22Z" };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response;
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.useRealTimers(); });
describe("runtime HTTP services", () => {
  it("uses the authoritative endpoints, 4 second timeout and idempotent bootstrap statuses", async () => {
    fetchMock.mockResolvedValueOnce(response(runtime)).mockResolvedValueOnce(response(preflight)).mockResolvedValueOnce(response({ job_id: "job", competence: "2026-07", status: "AUTHORIZED", replayed: false }, 202)).mockResolvedValueOnce(response({ job_id: "job", competence: "2026-07", status: "AUTHORIZED", replayed: true }, 200));
    await getRuntimeStatus(); await getBootstrapPreflight("2026-07"); await startBootstrap("2026-07"); await startBootstrap("2026-07");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/v1/runtime/status", "/api/v1/base/bootstrap/preflight?competence=2026-07", "/api/v1/base/bootstrap", "/api/v1/base/bootstrap"]);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST", body: JSON.stringify({ competence: "2026-07" }) });
  });
  it("rejects malformed HTTP 200 runtime payloads", async () => { fetchMock.mockResolvedValueOnce(response({ summary: "AVAILABLE" })); await expect(getRuntimeStatus()).rejects.toMatchObject({ code: "invalid_response" }); });

  it("uses URLSearchParams, AbortSignal and exact update endpoints", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(response(updatePreflight)).mockResolvedValueOnce(response(updatePreflight))
      .mockResolvedValueOnce(response({ job_id: "job", competence: "2026-08", status: "AUTHORIZED", replayed: false }, 202))
      .mockResolvedValueOnce(response({ job_id: "job", competence: "2026-08", status: "AUTHORIZED", replayed: true }, 200));
    await getUpdatePreflight(undefined, { signal: controller.signal });
    await getUpdatePreflight("2026-08", { signal: controller.signal });
    await startMonthlyUpdate("2026-08", { signal: controller.signal });
    await startMonthlyUpdate("2026-08", { signal: controller.signal });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/v1/base/update/preflight", "/api/v1/base/update/preflight?competence=2026-08", "/api/v1/base/update", "/api/v1/base/update"]);
    expect(fetchMock.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST", body: JSON.stringify({ competence: "2026-08" }) });
  });

  it.each([
    [409, "update_blocked"],
    [409, "update_conflict"],
    [422, "invalid_request"],
    [503, "database_unavailable"],
  ])("preserves the sanitized update error for HTTP %s", async (status, code) => {
    fetchMock.mockResolvedValueOnce(response({ error: { code, message: "public" } }, status));
    await expect(startMonthlyUpdate("2026-08")).rejects.toMatchObject({ code, status });
  });

  it("rejects malformed successful preflight and POST payloads", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...updatePreflight, worker_available: "yes" }))
      .mockResolvedValueOnce(response({ job_id: "job" }, 202));
    await expect(getUpdatePreflight()).rejects.toMatchObject({ code: "invalid_response" });
    await expect(startMonthlyUpdate("2026-08")).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("uses the four second timeout for update preflight", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const result = expect(getUpdatePreflight()).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(4_000);
    await result;
  });
});
