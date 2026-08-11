import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUpdatePreflight, startMonthlyUpdate } from "../../services/sentinelApi";
import { runtimeStatus } from "../../test/runtimeFixtures";
import type { UpdatePreflightResponse } from "../../types/api";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { MonthlyUpdatePanel } from "./MonthlyUpdatePanel";

vi.mock("../../services/sentinelApi", () => ({ getUpdatePreflight: vi.fn(), startMonthlyUpdate: vi.fn() }));
const preflightRequest = vi.mocked(getUpdatePreflight);
const startRequest = vi.mocked(startMonthlyUpdate);
const preflight: UpdatePreflightResponse = { source: "SERPRO_WEBDAV", active_competence: "2026-07", target_competence: "2026-08", file_count: 22, shard_count: 10, download_bytes: 1024, reusable_bytes: 512, remaining_download_bytes: 512, free_bytes: null, staging_estimate_bytes: null, database_ready: true, schema_current: true, worker_available: true, lock_available: true, conflict_with_job: false, blockers: [], can_start: true, observed_at: "2026-08-11T12:00:00Z" };
const refreshNow = vi.fn();

function view(runtime = runtimeStatus({ base: { available_competence: "2026-08", last_metadata_check_result: "UPDATE_AVAILABLE" } }), transportState: RuntimeLifecycleView["transportState"] = "fresh"): RuntimeLifecycleView {
  return { runtime, transportState, lastConfirmedAt: Date.now(), confirmationVersion: 1, checking: false, lastErrorCode: null, refreshNow };
}

describe("MonthlyUpdatePanel", () => {
  beforeEach(() => { preflightRequest.mockReset(); startRequest.mockReset(); refreshNow.mockReset(); preflightRequest.mockResolvedValue(preflight); startRequest.mockResolvedValue({ job_id: "job", competence: "2026-08", status: "AUTHORIZED", replayed: false }); });

  it("shows A to B metrics and an accessible confirmation without inventing nullable values", async () => {
    render(<MonthlyUpdatePanel runtime={view()} />);
    expect(await screen.findByRole("button", { name: "Atualizar agora" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova base da Receita disponível" })).toBeInTheDocument();
    expect(screen.getByText("2026-07")).toBeInTheDocument();
    expect(screen.getByText("2026-08")).toBeInTheDocument();
    expect(screen.getAllByText("Não confirmado")).toHaveLength(1);
    expect(screen.getAllByText("Não calculado")).toHaveLength(1);
    const trigger = screen.getByRole("button", { name: "Atualizar agora" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Atualizar base da Receita?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("submits one confirmed update and keeps the button busy", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof startMonthlyUpdate>>) => void;
    startRequest.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<MonthlyUpdatePanel runtime={view()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Atualizar agora" }));
    const confirm = screen.getByRole("button", { name: "Confirmar atualização" });
    fireEvent.click(confirm);
    expect(screen.getByRole("button", { name: "Autorizando..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Autorizando..." }));
    expect(startRequest).toHaveBeenCalledTimes(1);
    resolve({ job_id: "job", competence: "2026-08", status: "AUTHORIZED", replayed: false });
    await waitFor(() => expect(refreshNow).toHaveBeenCalledTimes(1));
  });

  it("shows real per-file download progress and no synthetic global progress", () => {
    render(<MonthlyUpdatePanel runtime={view(runtimeStatus({ components: { worker: { state: "RUNNING" } }, base: { active_operation: "UPDATE", preparing_competence: "2026-08" }, update: { job_id: "job", status: "RUNNING", stage: "DOWNLOAD", target_competence: "2026-08", progress: { file_index: 7, file_total: 22, bytes_received: 340, bytes_total: 510 } } }))} />);
    expect(screen.getByText("Baixando arquivos")).toBeInTheDocument();
    expect(screen.getByText("Arquivo 7 de 22")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progresso do arquivo atual da atualização" })).toHaveAttribute("max", "510");
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("keeps a pre-promotion failure distinct from bootstrap and never offers force", async () => {
    preflightRequest.mockResolvedValue({ ...preflight, can_start: false, blockers: ["workspace_insufficient"] });
    render(<MonthlyUpdatePanel runtime={view(runtimeStatus({ base: { available_competence: null }, update: { job_id: "job", status: "FAILED", stage: "VALIDATING_CANDIDATE", target_competence: "2026-08", failure_code: "candidate_large_decrease", finished_at: "2026-08-11T12:30:00Z" } }))} />);
    expect(screen.getByRole("heading", { name: "A atualização não foi concluída" })).toBeInTheDocument();
    expect(screen.getByText("A competência anterior continua disponível.")).toBeInTheDocument();
    expect(screen.getByText(/liberação excepcional permanece uma operação CLI/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /force|liberar/i })).not.toBeInTheDocument();
    expect(await screen.findByText("Não há espaço livre suficiente para preparar a atualização.")).toBeInTheDocument();
  });

  it("presents success and rollback as available terminal outcomes", () => {
    const succeeded = runtimeStatus({ base: { active_competence: "2026-08" }, update: { job_id: "job", status: "SUCCEEDED", stage: "SUCCEEDED", target_competence: "2026-08", promoted_at: "2026-08-11T12:20:00Z", finished_at: "2026-08-11T12:21:00Z" } });
    const { rerender } = render(<MonthlyUpdatePanel runtime={view(succeeded)} />);
    expect(screen.getByRole("heading", { name: "Base da Receita atualizada" })).toBeInTheDocument();
    rerender(<MonthlyUpdatePanel runtime={view(runtimeStatus({ base: { active_competence: "2026-07" }, update: { job_id: "job", status: "ROLLED_BACK", stage: "ROLLED_BACK", target_competence: "2026-08", rolled_back_at: "2026-08-11T12:30:00Z" } }))} />);
    expect(screen.getByRole("heading", { name: "Atualização revertida" })).toBeInTheDocument();
    expect(screen.getByText("A competência anterior foi restaurada com sucesso.")).toBeInTheDocument();
  });

  it("keeps SOURCE_UNAVAILABLE as a warning over a READY base", () => {
    render(<MonthlyUpdatePanel runtime={view(runtimeStatus({ base: { last_metadata_check_result: "SOURCE_UNAVAILABLE" } }))} />);
    expect(screen.getByText(/A competência ativa continua disponível\./)).toBeInTheDocument();
  });
});
