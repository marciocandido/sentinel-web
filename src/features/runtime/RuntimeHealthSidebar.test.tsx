import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuntimeHealthSidebar } from "./RuntimeHealthSidebar";
import type { RuntimeLifecycleView } from "./runtimeTypes";

const freshRuntime = { observed_at: "2026-08-07T19:43:22Z", summary: "AVAILABLE", components: { api: { state: "AVAILABLE", schema_current: null, last_seen_at: null }, database: { state: "AVAILABLE", schema_current: true, last_seen_at: null }, worker: { state: "IDLE", schema_current: null, last_seen_at: null } }, base: { state: "READY", active_competence: null, available_competence: null, preparing_competence: null, action_required: null, current_stage: null, progress: null, last_failure_code: null, last_failure_message: null } } as const;
const refreshNow = () => undefined;
const pending: RuntimeLifecycleView = { runtime: null, transportState: "pending", lastConfirmedAt: null, confirmationVersion: 0, checking: true, lastErrorCode: null, refreshNow };
const fresh: RuntimeLifecycleView = { runtime: freshRuntime, transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow };

describe("RuntimeHealthSidebar", () => {
  it("uses decorative checking loaders only until the first runtime confirmation", () => {
    const { container, rerender } = render(<RuntimeHealthSidebar runtime={pending} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar detalhes da saúde" }));
    const loaders = container.querySelectorAll(".runtime-health__checking-icon");
    expect(loaders).toHaveLength(3);
    loaders.forEach((loader) => expect(loader).toHaveAttribute("aria-hidden", "true"));
    expect(screen.getByText("API").parentElement).toHaveTextContent("APIVerificando");
    expect(screen.getByText("Banco").parentElement).toHaveTextContent("BancoVerificando");
    expect(screen.getByText("Worker").parentElement).toHaveTextContent("WorkerVerificando");

    rerender(<RuntimeHealthSidebar runtime={fresh} />);
    expect(container.querySelectorAll(".runtime-health__checking-icon")).toHaveLength(0);
    expect(container.querySelectorAll(".runtime-health__component-icon")).toHaveLength(3);
    expect(screen.getByText("API").parentElement).toHaveTextContent("APIDisponível");
    expect(screen.getByText("Banco").parentElement).toHaveTextContent("BancoDisponível");
    expect(screen.getByText("Worker").parentElement).toHaveTextContent("WorkerDisponível");
  });
});
