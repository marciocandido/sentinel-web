import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { BaseLifecycleGate } from "./BaseLifecycleGate";
import { runtimeStatus } from "../../test/runtimeFixtures";

vi.mock("../discovery/DiscoveryLanding", () => ({ DiscoveryLanding: () => <div data-testid="discovery">Discovery montado</div> }));

const refreshNow = vi.fn();
const view = (state: string | null): RuntimeLifecycleView => ({ runtime: runtimeStatus({ summary: state === "READY" ? "AVAILABLE" : "RESTRICTED", components: state === null ? { database: { state: "UNAVAILABLE", schema_current: null }, worker: { state: "UNAVAILABLE" } } : undefined, base: { state: state as never, available_competence: state === "READY" ? null : "2026-07", preparing_competence: state === "READY" ? null : "2026-07" } }), transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow });

describe("BaseLifecycleGate", () => {
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
});
