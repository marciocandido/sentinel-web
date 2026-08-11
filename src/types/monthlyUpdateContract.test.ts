import { describe, expect, it } from "vitest";
import { isRuntimeStatusResponse, isUpdatePreflightResponse } from "./api";
import { runtimeStatus } from "../test/runtimeFixtures";

const preflight = {
  source: "SERPRO_WEBDAV",
  active_competence: "2026-07",
  target_competence: "2026-08",
  file_count: 22,
  shard_count: 10,
  download_bytes: 1024,
  reusable_bytes: 128,
  remaining_download_bytes: 896,
  free_bytes: null,
  staging_estimate_bytes: null,
  database_ready: true,
  schema_current: true,
  worker_available: true,
  lock_available: true,
  conflict_with_job: false,
  blockers: [],
  can_start: true,
  observed_at: "2026-08-11T12:00:00-03:00",
};

describe("monthly update API guards", () => {
  it("accepts the complete post-#167 runtime and preserves previous competence", () => {
    const value = runtimeStatus({ base: { previous_competence: "2026-06" }, update: { job_id: "job-1", status: "RUNNING", stage: "PROMOTING", progress: {} } });
    expect(isRuntimeStatusResponse(value)).toBe(true);
    expect(value.base.previous_competence).toBe("2026-06");
  });

  it.each([
    ["missing update", (() => { const value = { ...runtimeStatus() } as Record<string, unknown>; delete value.update; return value; })()],
    ["unknown status", { ...runtimeStatus(), update: { ...runtimeStatus().update, status: "WAITING" } }],
    ["unknown stage", { ...runtimeStatus(), update: { ...runtimeStatus().update, stage: "CUTOVER" } }],
    ["invalid timestamp", { ...runtimeStatus(), update: { ...runtimeStatus().update, promoted_at: "yesterday" } }],
    ["array progress", { ...runtimeStatus(), update: { ...runtimeStatus().update, progress: [] } }],
  ])("rejects %s", (_label, value) => expect(isRuntimeStatusResponse(value)).toBe(false));

  it("accepts a valid update preflight, including nullable metrics and unknown blockers", () => {
    expect(isUpdatePreflightResponse({ ...preflight, blockers: ["future_blocker"] })).toBe(true);
  });

  it.each([
    ["negative metric", { ...preflight, file_count: -1 }],
    ["unsafe metric", { ...preflight, reusable_bytes: Number.MAX_SAFE_INTEGER + 1 }],
    ["coercive boolean", { ...preflight, can_start: 1 }],
    ["invalid observed_at", { ...preflight, observed_at: "2026-08-11" }],
  ])("rejects a preflight with %s", (_label, value) => expect(isUpdatePreflightResponse(value)).toBe(false));
});
