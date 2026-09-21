import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuntimeHealthSidebar } from "./RuntimeHealthSidebar";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { runtimeStatus } from "../../test/runtimeFixtures";

const freshRuntime = runtimeStatus();
const refreshNow = () => undefined;
const base: RuntimeLifecycleView = { runtime: freshRuntime, transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow };
const pending: RuntimeLifecycleView = { ...base, runtime: null, transportState: "pending", lastConfirmedAt: null, confirmationVersion: 0, checking: true };
const offline: RuntimeLifecycleView = { ...base, runtime: null, transportState: "degraded", lastErrorCode: "network_error" };

describe("RuntimeHealthSidebar", () => {
  it("keeps API, Banco and Worker permanently visible without any toggle", () => {
    render(<RuntimeHealthSidebar runtime={base} />);
    expect(screen.queryByRole("button", { name: /detalhes da saúde/i })).not.toBeInTheDocument();
    expect(screen.getByText("API")).toBeVisible();
    expect(screen.getByText("Banco")).toBeVisible();
    expect(screen.getByText("Worker")).toBeVisible();
    expect(screen.getByText("Sistema disponível")).toBeInTheDocument();
  });

  it("uses decorative checking loaders only until the first runtime confirmation", () => {
    const { container, rerender } = render(<RuntimeHealthSidebar runtime={pending} />);
    const loaders = container.querySelectorAll(".runtime-health__checking-icon");
    expect(loaders).toHaveLength(3);
    loaders.forEach((loader) => expect(loader).toHaveAttribute("aria-hidden", "true"));
    expect(screen.getByText("API").parentElement).toHaveTextContent("APIVerificando");
    expect(screen.getByText("Banco").parentElement).toHaveTextContent("BancoVerificando");
    expect(screen.getByText("Worker").parentElement).toHaveTextContent("WorkerVerificando");

    rerender(<RuntimeHealthSidebar runtime={base} />);
    expect(container.querySelectorAll(".runtime-health__checking-icon")).toHaveLength(0);
    expect(container.querySelectorAll(".runtime-health__component-icon")).toHaveLength(3);
    expect(screen.getByText("API").parentElement).toHaveTextContent("APIDisponível");
    expect(screen.getByText("Banco").parentElement).toHaveTextContent("BancoDisponível");
    expect(screen.getByText("Worker").parentElement).toHaveTextContent("WorkerDisponível");
  });

  it("does not rely on colour alone for healthy, attention and failure states", () => {
    const attention = { ...base, runtime: runtimeStatus({ components: { worker: { state: "STALE" } } }) };
    const { container, rerender } = render(<RuntimeHealthSidebar runtime={base} />);
    expect(container.querySelectorAll(".runtime-health__component-icon--ok")).toHaveLength(3);
    expect(screen.getByText("Worker").parentElement).toHaveAttribute("title", "Worker: Disponível");

    rerender(<RuntimeHealthSidebar runtime={attention} />);
    expect(container.querySelectorAll(".runtime-health__component-icon--attention")).toHaveLength(1);
    expect(screen.getByText("Worker").parentElement).toHaveTextContent("WorkerSem confirmação recente");
    expect(screen.getByText("Worker").parentElement).toHaveAttribute("title", "Worker: Sem confirmação recente");

    rerender(<RuntimeHealthSidebar runtime={offline} />);
    expect(container.querySelectorAll(".runtime-health__component-icon--danger")).toHaveLength(3);
    expect(screen.getByText("API").parentElement).toHaveTextContent("APIIndisponível");
    expect(screen.getByRole("button", { name: "Verificar novamente" })).toBeInTheDocument();
  });

  it("marks a database restriction without turning the API red", () => {
    const restricted = { ...base, runtime: runtimeStatus({ summary: "RESTRICTED", components: { database: { state: "AVAILABLE", schema_current: false } } }) };
    const { container } = render(<RuntimeHealthSidebar runtime={restricted} />);
    expect(container.querySelectorAll(".runtime-health__component-icon--ok")).toHaveLength(2);
    expect(screen.getByText("Banco").parentElement).toHaveTextContent("BancoDesconhecido");
    expect(container.querySelector(".runtime-health__component-icon--attention")).not.toBeNull();
  });
});
