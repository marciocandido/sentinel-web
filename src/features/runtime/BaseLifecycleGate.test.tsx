import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { BaseLifecycleGate } from "./BaseLifecycleGate";

const refreshNow = vi.fn();
const view = (state: string | null): RuntimeLifecycleView => ({ runtime: state === null ? { observed_at: "2026-08-07T00:00:00Z", summary: "UNAVAILABLE", components: { api: { state: "AVAILABLE", schema_current: null, last_seen_at: null }, database: { state: "UNAVAILABLE", schema_current: null, last_seen_at: null }, worker: { state: "UNAVAILABLE", schema_current: null, last_seen_at: null } }, base: { state: null, active_competence: null, available_competence: null, preparing_competence: null, action_required: null, current_stage: null, progress: null, last_failure_code: null, last_failure_message: null } } : { observed_at: "2026-08-07T00:00:00Z", summary: state === "READY" ? "AVAILABLE" : "RESTRICTED", components: { api: { state: "AVAILABLE", schema_current: null, last_seen_at: null }, database: { state: "AVAILABLE", schema_current: true, last_seen_at: null }, worker: { state: "IDLE", schema_current: null, last_seen_at: null } }, base: { state: state as never, active_competence: null, available_competence: "2026-07", preparing_competence: "2026-07", action_required: null, current_stage: null, progress: null, last_failure_code: null, last_failure_message: null } }, transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow });

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
});
