import { describe, expect, it } from "vitest";
import { presentBaseCompetence } from "./baseCompetencePresentation";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { runtimeStatus } from "../../test/runtimeFixtures";

const view = (overrides: Partial<RuntimeLifecycleView> = {}): RuntimeLifecycleView => ({
  runtime: runtimeStatus(),
  transportState: "fresh",
  lastConfirmedAt: Date.now(),
  confirmationVersion: 1,
  checking: false,
  lastErrorCode: null,
  refreshNow: () => undefined,
  ...overrides,
});

describe("apresentação da competência da Receita", () => {
  it("usa verde somente com evidência de que a competência ativa é a vigente", () => {
    const upToDate = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: "2026-08", last_metadata_check_result: "UP_TO_DATE" } }) }));
    expect(upToDate).toMatchObject({ competence: "2026-08", tone: "ok" });
    expect(upToDate.note).toContain("não encontrou uma nova competência");

    const announcedEqualsActive = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: "2026-08", available_competence: "2026-08", last_metadata_check_result: "UPDATE_AVAILABLE" } }) }));
    expect(announcedEqualsActive.tone).toBe("ok");
    expect(announcedEqualsActive.note).toContain("já é a ativa");

    const succeeded = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: "2026-08", last_metadata_check_result: null }, update: { job_id: "job", status: "SUCCEEDED", stage: "SUCCEEDED", target_competence: "2026-08", promoted_at: "2026-08-11T12:20:00Z" } }) }));
    expect(succeeded.tone).toBe("ok");
    expect(succeeded.note).toContain("foi concluída");
  });

  it("usa azul para competência nova real e para atualização em andamento", () => {
    const announced = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: "2026-08", available_competence: "2026-09" } }) }));
    expect(announced).toMatchObject({ competence: "2026-08", tone: "info" });
    expect(announced.note).toContain("2026-09");

    const running = presentBaseCompetence(view({ runtime: runtimeStatus({ components: { worker: { state: "RUNNING" } }, base: { active_competence: "2026-08", active_operation: "UPDATE" }, update: { job_id: "job", status: "RUNNING", stage: "DOWNLOAD", target_competence: "2026-09" } }) }));
    expect(running.tone).toBe("info");
    expect(running.note).toContain("em andamento");
  });

  it("usa amarelo para stale, degraded, fonte indisponível, falha e competência não confirmada", () => {
    expect(presentBaseCompetence(view({ transportState: "stale" })).tone).toBe("attention");
    expect(presentBaseCompetence(view({ transportState: "degraded" })).tone).toBe("attention");
    expect(presentBaseCompetence(view({ runtime: runtimeStatus({ base: { last_metadata_check_result: "SOURCE_UNAVAILABLE" } }) })).tone).toBe("attention");
    expect(presentBaseCompetence(view({ runtime: runtimeStatus({ update: { job_id: "job", status: "FAILED", stage: "VALIDATING_CANDIDATE" } }) })).tone).toBe("attention");
    expect(presentBaseCompetence(view({ runtime: runtimeStatus({ update: { job_id: "job", status: "ROLLED_BACK", stage: "ROLLED_BACK" } }) })).tone).toBe("attention");
    const unconfirmed = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: null, last_metadata_check_result: null } }) }));
    expect(unconfirmed).toMatchObject({ competence: null, tone: "attention" });
    expect(unconfirmed.note).toContain("não confirmada");
    expect(presentBaseCompetence(view({ runtime: runtimeStatus({ base: { state: "PROCESSING" } }) })).tone).toBe("attention");
  });

  it("usa vermelho quando a base está efetivamente indisponível", () => {
    expect(presentBaseCompetence(view({ runtime: runtimeStatus({ base: { state: "UNAVAILABLE" } }) })).tone).toBe("danger");
    expect(presentBaseCompetence(view({ runtime: runtimeStatus({ base: { state: "FAILED" } }) })).tone).toBe("danger");
    expect(presentBaseCompetence(view({ runtime: null, transportState: "degraded", lastErrorCode: "network_error" }))).toMatchObject({ competence: null, tone: "danger" });
  });

  it("usa neutro quando conhece a competência mas não tem evidência de freshness", () => {
    const neutral = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: "2026-08", last_metadata_check_result: null } }) }));
    expect(neutral).toMatchObject({ competence: "2026-08", tone: "neutral" });
    expect(neutral.note).toContain("Não há verificação recente");
    expect(presentBaseCompetence(view({ runtime: null, transportState: "pending" })).tone).toBe("neutral");
  });

  it("não afirma atualização apenas porque existe competência ativa", () => {
    const onlyActive = presentBaseCompetence(view({ runtime: runtimeStatus({ base: { active_competence: "2026-08", last_metadata_check_result: null } }) }));
    expect(onlyActive.tone).not.toBe("ok");
    expect(onlyActive.note).not.toMatch(/atualizada/i);
  });
});
