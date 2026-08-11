import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SentinelApiError } from "../../services/apiClient";
import { getUpdatePreflight, startMonthlyUpdate } from "../../services/sentinelApi";
import { runtimeStatus } from "../../test/runtimeFixtures";
import type { UpdatePreflightResponse } from "../../types/api";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { useMonthlyUpdate } from "./useMonthlyUpdate";

vi.mock("../../services/sentinelApi", () => ({ getUpdatePreflight: vi.fn(), startMonthlyUpdate: vi.fn() }));
const preflightRequest = vi.mocked(getUpdatePreflight);
const startRequest = vi.mocked(startMonthlyUpdate);
const refreshNow = vi.fn();
const preflight: UpdatePreflightResponse = { source: "SERPRO_WEBDAV", active_competence: "2026-07", target_competence: "2026-08", file_count: 22, shard_count: 10, download_bytes: 1000, reusable_bytes: 100, remaining_download_bytes: 900, free_bytes: 2000, staging_estimate_bytes: 500, database_ready: true, schema_current: true, worker_available: true, lock_available: true, conflict_with_job: false, blockers: [], can_start: true, observed_at: "2026-08-11T12:00:00Z" };

function view(overrides: Partial<RuntimeLifecycleView> = {}): RuntimeLifecycleView {
  return { runtime: runtimeStatus({ base: { available_competence: "2026-08", last_metadata_check_result: "UPDATE_AVAILABLE" } }), transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow, ...overrides };
}

function Harness({ runtime }: { runtime: RuntimeLifecycleView }) {
  const state = useMonthlyUpdate(runtime);
  return <><output data-testid="target">{state.target ?? "none"}</output><output data-testid="preflight">{state.preflight?.target_competence ?? "none"}</output><output data-testid="state">{state.uncertain ? "uncertain" : state.accepted ? "accepted" : state.error ?? "idle"}</output><button onClick={() => void state.start()}>start</button><button onClick={() => void state.reload()}>reload</button></>;
}

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

describe("useMonthlyUpdate", () => {
  beforeEach(() => { preflightRequest.mockReset(); startRequest.mockReset(); refreshNow.mockReset(); preflightRequest.mockResolvedValue(preflight); });

  it("does not load preflight without a target and uses available competence when present", async () => {
    const { rerender } = render(<Harness runtime={view({ runtime: runtimeStatus() })} />);
    await act(async () => Promise.resolve());
    expect(preflightRequest).not.toHaveBeenCalled();
    rerender(<Harness runtime={view()} />);
    await waitFor(() => expect(preflightRequest).toHaveBeenCalledWith("2026-08", expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(screen.getByTestId("preflight")).toHaveTextContent("2026-08");
  });

  it("cancels obsolete preflight and ignores its late response", async () => {
    const first = deferred<typeof preflight>();
    preflightRequest.mockImplementationOnce((_target, options) => new Promise((resolve) => {
      options?.signal?.addEventListener("abort", () => undefined);
      void first.promise.then(resolve);
    })).mockResolvedValueOnce({ ...preflight, target_competence: "2026-09" });
    const { rerender } = render(<Harness runtime={view()} />);
    await waitFor(() => expect(preflightRequest).toHaveBeenCalledTimes(1));
    const firstSignal = preflightRequest.mock.calls[0][1]?.signal as AbortSignal;
    rerender(<Harness runtime={view({ runtime: runtimeStatus({ base: { available_competence: "2026-09" } }) })} />);
    await waitFor(() => expect(preflightRequest).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    first.resolve(preflight);
    await act(async () => Promise.resolve());
    expect(screen.getByTestId("preflight")).toHaveTextContent("2026-09");
  });

  it("prevents concurrent POSTs and refreshes runtime after acceptance", async () => {
    const pending = deferred<Awaited<ReturnType<typeof startMonthlyUpdate>>>();
    startRequest.mockImplementation(() => pending.promise);
    render(<Harness runtime={view()} />);
    await waitFor(() => expect(screen.getByTestId("preflight")).toHaveTextContent("2026-08"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(startRequest).toHaveBeenCalledTimes(1);
    pending.resolve({ job_id: "job", competence: "2026-08", status: "AUTHORIZED", replayed: false });
    await waitFor(() => expect(refreshNow).toHaveBeenCalledTimes(1));
  });

  it("does not accept the historical job for the same target after an uncertain retry", async () => {
    startRequest.mockRejectedValue(new SentinelApiError("request_timeout", "timeout"));
    const initial = view({ runtime: runtimeStatus({ base: { available_competence: null }, update: { job_id: "old-job", status: "FAILED", stage: "VALIDATING_CANDIDATE", target_competence: "2026-08" } }) });
    const { rerender } = render(<Harness runtime={initial} />);
    await waitFor(() => expect(screen.getByTestId("preflight")).toHaveTextContent("2026-08"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("uncertain"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(startRequest).toHaveBeenCalledTimes(1);
    expect(refreshNow).toHaveBeenCalledTimes(1);
    rerender(<Harness runtime={view({ confirmationVersion: 2, runtime: runtimeStatus({ base: { available_competence: null }, update: { job_id: "old-job", status: "FAILED", stage: "VALIDATING_CANDIDATE", target_competence: "2026-08" } }) })} />);
    await waitFor(() => expect(preflightRequest).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("state")).not.toHaveTextContent("accepted");
    expect(startRequest).toHaveBeenCalledTimes(1);
  });

  it("ends uncertainty after a fresh runtime proves no new update was persisted", async () => {
    startRequest.mockRejectedValue(new SentinelApiError("request_timeout", "timeout"));
    const { rerender } = render(<Harness runtime={view()} />);
    await waitFor(() => expect(screen.getByTestId("preflight")).toHaveTextContent("2026-08"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("uncertain"));

    rerender(<Harness runtime={view({ confirmationVersion: 2, runtime: runtimeStatus({ base: { available_competence: "2026-08", active_operation: null } }) })} />);
    await waitFor(() => expect(preflightRequest).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("idle"));
    expect(startRequest).toHaveBeenCalledTimes(1);

    startRequest.mockResolvedValueOnce({ job_id: "new-job", competence: "2026-08", status: "AUTHORIZED", replayed: false });
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(2));
  });

  it("accepts an uncertain retry only after a new matching job appears", async () => {
    startRequest.mockRejectedValue(new SentinelApiError("request_timeout", "timeout"));
    const { rerender } = render(<Harness runtime={view({ runtime: runtimeStatus({ base: { available_competence: null }, update: { job_id: "old-job", status: "FAILED", stage: "VALIDATING_CANDIDATE", target_competence: "2026-08" } }) })} />);
    await waitFor(() => expect(screen.getByTestId("preflight")).toHaveTextContent("2026-08"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("uncertain"));

    rerender(<Harness runtime={view({ confirmationVersion: 2, runtime: runtimeStatus({ base: { available_competence: null, active_operation: "UPDATE" }, update: { job_id: "new-job", status: "RUNNING", stage: "DISCOVERY", target_competence: "2026-08" } }) })} />);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("accepted"));
    expect(startRequest).toHaveBeenCalledTimes(1);
  });

  it("does not authorize from a stale runtime snapshot", async () => {
    render(<Harness runtime={view({ transportState: "stale" })} />);
    await act(async () => Promise.resolve());
    expect(preflightRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(startRequest).not.toHaveBeenCalled();
  });

  it("refreshes runtime after a conflict and reloads preflight after confirmation", async () => {
    startRequest.mockRejectedValue(new SentinelApiError("update_conflict", "conflict", 409));
    const { rerender } = render(<Harness runtime={view()} />);
    await waitFor(() => expect(screen.getByTestId("preflight")).toHaveTextContent("2026-08"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(refreshNow).toHaveBeenCalledTimes(1));
    rerender(<Harness runtime={view({ confirmationVersion: 2 })} />);
    await waitFor(() => expect(preflightRequest).toHaveBeenCalledTimes(2));
  });
});
