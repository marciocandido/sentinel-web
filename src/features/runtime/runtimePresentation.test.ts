import { describe, expect, it } from "vitest";
import { presentRuntime } from "./runtimePresentation";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { runtimeStatus } from "../../test/runtimeFixtures";

const healthy = runtimeStatus();
function view(overrides: Partial<RuntimeLifecycleView> = {}): RuntimeLifecycleView { return { runtime: healthy, transportState: "fresh", lastConfirmedAt: Date.now(), confirmationVersion: 0, checking: false, lastErrorCode: null, refreshNow: () => undefined, ...overrides }; }

describe("runtime presentation", () => {
  it("keeps an unconfirmed initial request neutral", () => {
    expect(presentRuntime(view({ runtime: null, transportState: "pending" }))).toMatchObject({
      summary: "Verificação pendente", tone: "neutral", api: "Verificando", database: "Verificando", worker: "Verificando",
    });
  });

  it("shows transport unavailability only after an initial request fails", () => {
    expect(presentRuntime(view({ runtime: null, transportState: "degraded", lastErrorCode: "network_error" }))).toMatchObject({
      summary: "Sistema indisponível", tone: "danger", api: "Indisponível", database: "Desconhecido", worker: "Desconhecido",
    });
  });

  it("covers the seven public summaries without exposing raw runtime fields", () => {
    expect(presentRuntime(view({ runtime: null, transportState: "pending" })).summary).toBe("Verificação pendente");
    expect(presentRuntime(view({ runtime: runtimeStatus({ base: { state: "AWAITING_OPERATOR" } }) })).summary).toBe("Configuração necessária");
    expect(presentRuntime(view({ runtime: runtimeStatus({ base: { state: "PROCESSING" } }) })).summary).toBe("Sistema inicializando");
    expect(presentRuntime(view()).summary).toBe("Sistema disponível");
    expect(presentRuntime(view({ runtime: runtimeStatus({ base: { state: "FAILED" } }) })).summary).toBe("Sistema com restrição");
    expect(presentRuntime(view({ runtime: null, transportState: "degraded", lastErrorCode: "network_error" })).summary).toBe("Sistema indisponível");
    expect(presentRuntime(view({ transportState: "stale" })).summary).toBe("Dados desatualizados");
  });
  it("keeps backend worker stale distinct from a stale frontend snapshot", () => {
    expect(presentRuntime(view({ runtime: runtimeStatus({ components: { worker: { state: "STALE" } } }) })).summary).toBe("Sistema com restrição");
    expect(presentRuntime(view({ transportState: "stale" }))).toMatchObject({
      summary: "Dados desatualizados", api: "Desatualizado", database: "Desatualizado", worker: "Desatualizado",
    });
  });
  it("keeps the system available while the monthly worker is active", () => {
    const running = runtimeStatus({ components: { worker: { state: "RUNNING" } }, base: { active_operation: "UPDATE" }, update: { job_id: "job", status: "RUNNING", stage: "PROMOTING", target_competence: "2026-08" } });
    expect(presentRuntime(view({ runtime: running }))).toMatchObject({ summary: "Sistema disponível", worker: "Atualizando base" });
    const waiting = runtimeStatus({ base: { active_operation: "UPDATE" }, update: { job_id: "job", status: "RUNNING", stage: "PROMOTION_WAITING", target_competence: "2026-08" } });
    expect(presentRuntime(view({ runtime: waiting }))).toMatchObject({ summary: "Sistema disponível", worker: "Atualização aguardando retomada" });
  });

  it("treats a failed update over READY as a restriction and a rollback as available", () => {
    expect(presentRuntime(view({ runtime: runtimeStatus({ update: { job_id: "job", status: "FAILED", stage: "VALIDATING_CANDIDATE" } }) }))).toMatchObject({ summary: "Sistema com restrição" });
    expect(presentRuntime(view({ runtime: runtimeStatus({ update: { job_id: "job", status: "ROLLED_BACK", stage: "ROLLED_BACK" } }) }))).toMatchObject({ summary: "Sistema disponível" });
  });
});
