import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeStatus } from "../../services/sentinelApi";
import { useRuntimeLifecycle } from "./useRuntimeLifecycle";
import { runtimeStatus } from "../../test/runtimeFixtures";

vi.mock("../../services/sentinelApi", () => ({ getRuntimeStatus: vi.fn() }));
const runtimeRequest = vi.mocked(getRuntimeStatus);
const healthy = runtimeStatus();
const degraded = runtimeStatus({ summary: "RESTRICTED" });
const processing = runtimeStatus({ summary: "INITIALIZING", components: { worker: { state: "RUNNING" } }, base: { state: "PROCESSING", preparing_competence: "2099-01", current_stage: "BUILD_BASE_UTIL", progress: { phase: "PROCESSING", stage: "BUILD_BASE_UTIL" } } });
function Harness() { const runtime = useRuntimeLifecycle(); return <><output data-testid="transport">{runtime.transportState}</output><output data-testid="state">{runtime.runtime?.summary ?? "none"}</output><output data-testid="lifecycle">{runtime.runtime?.base.state ?? "none"}</output><output data-testid="checking">{String(runtime.checking)}</output><button onClick={runtime.refreshNow}>refresh</button></>; }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
async function flush() { await act(async () => { await Promise.resolve(); }); }
function hidden(value: boolean) { Object.defineProperty(document, "hidden", { configurable: true, value }); document.dispatchEvent(new Event("visibilitychange")); }

describe("useRuntimeLifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-07T19:43:22Z")); runtimeRequest.mockReset(); Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("starts immediately, uses 15 seconds until two healthy rounds, then 60 seconds", async () => {
    runtimeRequest.mockResolvedValue(healthy);
    render(<Harness />); await flush(); expect(runtimeRequest).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(15_000)); expect(runtimeRequest).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(59_999)); expect(runtimeRequest).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1)); expect(runtimeRequest).toHaveBeenCalledTimes(3);
  });

  it("restarts an aborted initial round during the real StrictMode effect replay", async () => {
    const first = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>();
    const second = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>();
    runtimeRequest.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    render(<StrictMode><Harness /></StrictMode>);
    expect(runtimeRequest).toHaveBeenCalledTimes(2);
    const firstSignal = runtimeRequest.mock.calls[0][0]?.signal as AbortSignal;
    const secondSignal = runtimeRequest.mock.calls[1][0]?.signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    second.resolve(processing); await flush();
    expect(screen.getByTestId("lifecycle")).toHaveTextContent("PROCESSING");
    expect(screen.getByTestId("transport")).toHaveTextContent("fresh");
    expect(screen.getByTestId("checking")).toHaveTextContent("false");

    first.resolve(healthy); await flush();
    expect(screen.getByTestId("lifecycle")).toHaveTextContent("PROCESSING");
    expect(screen.getByTestId("transport")).toHaveTextContent("fresh");
    expect(screen.getByTestId("checking")).toHaveTextContent("false");
  });

  it("returns to 15 seconds after a degraded response", async () => {
    runtimeRequest.mockResolvedValueOnce(healthy).mockResolvedValueOnce(healthy).mockResolvedValueOnce(degraded).mockResolvedValueOnce(healthy);
    render(<Harness />); await flush(); await act(async () => vi.advanceTimersByTimeAsync(15_000)); await act(async () => vi.advanceTimersByTimeAsync(60_000));
    await act(async () => vi.advanceTimersByTimeAsync(14_999)); expect(runtimeRequest).toHaveBeenCalledTimes(3);
    await act(async () => vi.advanceTimersByTimeAsync(1)); expect(runtimeRequest).toHaveBeenCalledTimes(4);
  });

  it("keeps fast polling for an active or failed monthly update", async () => {
    const running = runtimeStatus({ components: { worker: { state: "RUNNING" } }, update: { job_id: "job", status: "RUNNING", stage: "PROCESSING", target_competence: "2026-08" } });
    const failed = runtimeStatus({ update: { job_id: "job", status: "FAILED", stage: "VALIDATING_CANDIDATE", target_competence: "2026-08" } });
    runtimeRequest.mockResolvedValueOnce(running).mockResolvedValueOnce(running).mockResolvedValueOnce(failed);
    render(<Harness />); await flush();
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(runtimeRequest).toHaveBeenCalledTimes(3);
  });

  it("does not overlap, aborts an old refresh and ignores its late response", async () => {
    const first = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>(); const second = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>();
    runtimeRequest.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    render(<Harness />); expect(runtimeRequest).toHaveBeenCalledTimes(1);
    const firstSignal = runtimeRequest.mock.calls[0][0]?.signal as AbortSignal;
    await act(async () => vi.advanceTimersByTimeAsync(120_000)); expect(runtimeRequest).toHaveBeenCalledTimes(1);
    await act(async () => screen.getByRole("button", { name: "refresh" }).click()); expect(firstSignal.aborted).toBe(true);
    second.resolve({ ...healthy, summary: "RESTRICTED" }); await flush(); first.resolve(healthy); await flush();
    expect(screen.getByTestId("state")).toHaveTextContent("RESTRICTED");
  });

  it("pauses and aborts while hidden, then refreshes immediately when visible", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>(); runtimeRequest.mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(healthy);
    const { unmount } = render(<Harness />); const signal = runtimeRequest.mock.calls[0][0]?.signal as AbortSignal;
    await act(async () => hidden(true)); expect(signal.aborted).toBe(true); await act(async () => vi.advanceTimersByTimeAsync(180_000)); expect(runtimeRequest).toHaveBeenCalledTimes(1);
    await act(async () => hidden(false)); expect(runtimeRequest).toHaveBeenCalledTimes(2); unmount();
  });

  it("marks the snapshot stale immediately on visible after 120 seconds before its refresh resolves", async () => {
    const next = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>(); runtimeRequest.mockResolvedValueOnce(healthy).mockImplementationOnce(() => next.promise);
    render(<Harness />); await flush(); await act(async () => hidden(true)); await act(async () => vi.advanceTimersByTimeAsync(120_001));
    await act(async () => hidden(false)); expect(screen.getByTestId("transport")).toHaveTextContent("stale"); expect(runtimeRequest).toHaveBeenCalledTimes(2);
    next.resolve(healthy); await flush(); expect(screen.getByTestId("transport")).toHaveTextContent("fresh");
  });

  it("marks an expired snapshot stale before a manual refresh resolves", async () => {
    const next = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>(); runtimeRequest.mockResolvedValueOnce(healthy).mockImplementationOnce(() => next.promise);
    render(<Harness />); await flush(); vi.setSystemTime(new Date(Date.now() + 120_001));
    await act(async () => screen.getByRole("button", { name: "refresh" }).click());
    expect(screen.getByTestId("transport")).toHaveTextContent("stale"); next.resolve(healthy); await flush();
  });

  it("aborts the in-flight request on unmount without a late update", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getRuntimeStatus>>>(); runtimeRequest.mockImplementationOnce(() => pending.promise);
    const { unmount } = render(<Harness />); const signal = runtimeRequest.mock.calls[0][0]?.signal as AbortSignal; unmount(); expect(signal.aborted).toBe(true);
    pending.resolve(healthy); await flush(); expect(runtimeRequest).toHaveBeenCalledTimes(1);
  });
});
