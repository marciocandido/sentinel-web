import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBootstrapPreflight } from "../../services/sentinelApi";
import type { BootstrapPreflightResponse } from "../../types/api";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { BaseLifecycleGate } from "./BaseLifecycleGate";
import { runtimeStatus } from "../../test/runtimeFixtures";

vi.mock("../discovery/DiscoveryLanding", () => ({ DiscoveryLanding: () => <div data-testid="discovery">Discovery montado</div> }));
vi.mock("../../services/sentinelApi", () => ({ getBootstrapPreflight: vi.fn(), startBootstrap: vi.fn(), getUpdatePreflight: vi.fn(), startMonthlyUpdate: vi.fn() }));

const refreshNow = vi.fn();
const bootstrapPreflight: BootstrapPreflightResponse = { source: "SERPRO_WEBDAV", competence: "2026-08", file_count: 1, shard_count: 1, download_bytes: 100, reusable_bytes: 0, remaining_download_bytes: 100, free_bytes: 1000, workspace_estimate_bytes: 100, database_ready: true, schema_current: true, worker_available: true, lock_available: true, blockers: [], can_start: true, observed_at: "2026-08-11T12:00:00Z" };
const view = (state: string | null): RuntimeLifecycleView => ({ runtime: runtimeStatus({ summary: state === "READY" ? "AVAILABLE" : "RESTRICTED", components: state === null ? { database: { state: "UNAVAILABLE", schema_current: null }, worker: { state: "UNAVAILABLE" } } : undefined, base: { state: state as never, available_competence: state === "READY" ? null : "2026-07", preparing_competence: state === "READY" ? null : "2026-07" } }), transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow });

describe("BaseLifecycleGate", () => {
  beforeEach(() => {
    refreshNow.mockReset();
    vi.mocked(getBootstrapPreflight).mockReset();
    vi.mocked(getBootstrapPreflight).mockResolvedValue(bootstrapPreflight);
  });

  it("does not turn unavailable or null base states into progress", () => {
    const { rerender } = render(<BaseLifecycleGate runtime={view("UNAVAILABLE")} />);
    expect(screen.getByText("Não foi possível confirmar o estado da base")).toBeInTheDocument();
    expect(screen.queryByText("Preparando base da Receita")).not.toBeInTheDocument();
    rerender(<BaseLifecycleGate runtime={view(null)} />);
    expect(screen.queryByText("Preparando base da Receita")).not.toBeInTheDocument();
  });

  it("renders progress only for an active lifecycle state", () => {
    render(<BaseLifecycleGate runtime={view("PROCESSING")} />);
    expect(screen.getByText("Preparando base da Receita")).toBeInTheDocument();
  });

  it("keeps Discovery mounted while a monthly update is running", () => {
    const runtime = view("READY");
    runtime.runtime = runtimeStatus({ components: { worker: { state: "RUNNING" } }, base: { active_operation: "UPDATE", preparing_competence: "2026-08" }, update: { job_id: "job", status: "RUNNING", stage: "LOADING_CANDIDATE", target_competence: "2026-08" } });
    render(<BaseLifecycleGate runtime={runtime} />);
    expect(screen.getByTestId("discovery")).toBeInTheDocument();
    expect(screen.getByText("Carregando geração candidata")).toBeInTheDocument();
  });

  it.each([
    ["RETRY_MONTHLY_ROLLBACK", "ROLLING_BACK", "Recuperação da atualização em andamento"],
    ["MANUAL_MONTHLY_ROLLBACK", "ROLLBACK_FAILED", "A atualização exige recuperação operacional"],
  ] as const)("does not render BootstrapFailure for monthly recovery %s", (action, stage, heading) => {
    const runtime = view("FAILED");
    runtime.runtime = runtimeStatus({ summary: "UNAVAILABLE", base: { state: "FAILED", action_required: action }, update: { job_id: "job", status: "FAILED", stage, target_competence: "2026-08", failure_code: "monthly_rollback_failed" } });
    render(<BaseLifecycleGate runtime={runtime} />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText("A preparação da base não foi concluída")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preparar base/ })).not.toBeInTheDocument();
  });

  it("keeps a historical rollback failure from replacing the current bootstrap recovery", async () => {
    const runtime = view("FAILED");
    runtime.runtime = runtimeStatus({ summary: "UNAVAILABLE", base: { state: "FAILED", action_required: "RETRY_BOOTSTRAP", active_operation: null }, update: { job_id: "historical-update", status: "FAILED", stage: "ROLLBACK_FAILED", target_competence: "2026-08", failure_code: "monthly_rollback_failed" } });
    render(<BaseLifecycleGate runtime={runtime} />);
    expect(screen.getByRole("heading", { name: "A preparação da base não foi concluída" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A atualização exige recuperação operacional" })).not.toBeInTheDocument();
    await waitFor(() => expect(getBootstrapPreflight).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
