import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBootstrapPreflight, getRuntimeStatus, startBootstrap } from "./sentinelApi";

const runtime = { observed_at: "2026-08-07T19:43:22Z", summary: "AVAILABLE", components: { api: { state: "AVAILABLE", schema_current: null, last_seen_at: null }, database: { state: "AVAILABLE", schema_current: true, last_seen_at: null }, worker: { state: "IDLE", schema_current: null, last_seen_at: null } }, base: { state: "READY", active_competence: null, available_competence: null, preparing_competence: null, action_required: null, current_stage: null, progress: {}, last_failure_code: null, last_failure_message: null } };
const preflight = { source: "SERPRO_WEBDAV", competence: "2026-07", file_count: 2, shard_count: 1, download_bytes: 1, reusable_bytes: 0, remaining_download_bytes: 1, free_bytes: 2, workspace_estimate_bytes: null, database_ready: true, schema_current: true, worker_available: true, lock_available: true, blockers: [], can_start: true, observed_at: "2026-08-07T19:43:22Z" };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response;
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
describe("runtime HTTP services", () => {
  it("uses the authoritative endpoints, 4 second timeout and idempotent bootstrap statuses", async () => {
    fetchMock.mockResolvedValueOnce(response(runtime)).mockResolvedValueOnce(response(preflight)).mockResolvedValueOnce(response({ job_id: "job", competence: "2026-07", status: "AUTHORIZED", replayed: false }, 202)).mockResolvedValueOnce(response({ job_id: "job", competence: "2026-07", status: "AUTHORIZED", replayed: true }, 200));
    await getRuntimeStatus(); await getBootstrapPreflight("2026-07"); await startBootstrap("2026-07"); await startBootstrap("2026-07");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/v1/runtime/status", "/api/v1/base/bootstrap/preflight?competence=2026-07", "/api/v1/base/bootstrap", "/api/v1/base/bootstrap"]);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST", body: JSON.stringify({ competence: "2026-07" }) });
  });
  it("rejects malformed HTTP 200 runtime payloads", async () => { fetchMock.mockResolvedValueOnce(response({ summary: "AVAILABLE" })); await expect(getRuntimeStatus()).rejects.toMatchObject({ code: "invalid_response" }); });
});
