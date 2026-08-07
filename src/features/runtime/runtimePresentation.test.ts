import { describe, expect, it } from "vitest";
import { presentRuntime } from "./runtimePresentation";
import type { RuntimeLifecycleView } from "./runtimeTypes";

const healthy = { observed_at: "2026-08-07T19:43:22Z", summary: "AVAILABLE", components: { api: { state: "AVAILABLE", schema_current: null, last_seen_at: null }, database: { state: "AVAILABLE", schema_current: true, last_seen_at: null }, worker: { state: "IDLE", schema_current: null, last_seen_at: null } }, base: { state: "READY", active_competence: null, available_competence: null, preparing_competence: null, action_required: null, current_stage: null, progress: null, last_failure_code: null, last_failure_message: null } } as const;
function view(overrides: Partial<RuntimeLifecycleView> = {}): RuntimeLifecycleView { return { runtime: healthy, transportState: "fresh", lastConfirmedAt: Date.now(), checking: false, lastErrorCode: null, refreshNow: () => undefined, ...overrides }; }

describe("runtime presentation", () => {
  it("covers the seven public summaries without exposing raw runtime fields", () => {
    expect(presentRuntime(view({ runtime: null, transportState: "pending" })).summary).toBe("Verificação pendente");
    expect(presentRuntime(view({ runtime: { ...healthy, base: { ...healthy.base, state: "AWAITING_OPERATOR" } } })).summary).toBe("Configuração necessária");
    expect(presentRuntime(view({ runtime: { ...healthy, base: { ...healthy.base, state: "PROCESSING" } } })).summary).toBe("Sistema inicializando");
    expect(presentRuntime(view()).summary).toBe("Sistema disponível");
    expect(presentRuntime(view({ runtime: { ...healthy, base: { ...healthy.base, state: "FAILED" } } })).summary).toBe("Sistema com restrição");
    expect(presentRuntime(view({ runtime: null, transportState: "degraded", lastErrorCode: "network_error" })).summary).toBe("Sistema indisponível");
    expect(presentRuntime(view({ transportState: "stale" })).summary).toBe("Dados desatualizados");
  });
  it("keeps backend worker stale distinct from a stale frontend snapshot", () => {
    expect(presentRuntime(view({ runtime: { ...healthy, components: { ...healthy.components, worker: { ...healthy.components.worker, state: "STALE" } } } })).summary).toBe("Sistema com restrição");
    expect(presentRuntime(view({ transportState: "stale" })).worker).toBe("Disponível");
  });
});
