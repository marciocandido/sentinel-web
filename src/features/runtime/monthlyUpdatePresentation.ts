import type { RuntimeUpdate, UpdatePreflightResponse } from "../../types/api";
import { competenceLabel, formatBytes, progressPair, progressUnitLabel, shardPair } from "./bootstrapPresentation";

const blockers: Record<string, string> = {
  source_unavailable: "Não foi possível confirmar a publicação da Receita.",
  workspace_unavailable: "O espaço de trabalho do servidor não está disponível.",
  database_unavailable: "O banco do Sentinel está indisponível.",
  base_not_ready: "A base atual ainda não está pronta para atualização.",
  active_competence_unknown: "A competência ativa ainda não pôde ser confirmada.",
  downgrade_blocked: "A competência informada é anterior à base ativa.",
  target_already_active: "Esta competência já está ativa.",
  worker_unavailable: "O serviço responsável pela atualização não está disponível.",
  job_active: "Já existe uma operação da base em andamento.",
  lock_unavailable: "A atualização está temporariamente ocupada.",
  workspace_insufficient: "Não há espaço livre suficiente para preparar a atualização.",
};

const stages: Record<NonNullable<RuntimeUpdate["stage"]>, string> = {
  DISCOVERY: "Preparando atualização",
  DOWNLOAD: "Baixando arquivos",
  PROCESSING: "Processando dados",
  VALIDATING_GENERATION: "Validando geração processada",
  LOADING_CANDIDATE: "Carregando geração candidata",
  VALIDATING_CANDIDATE: "Validando geração candidata",
  CANDIDATE_READY: "Geração candidata pronta",
  PRE_PROMOTION_BACKUP: "Criando backup pré-promoção",
  PROMOTION_WAITING: "Promoção aguardando retomada",
  PROMOTING: "Promovendo nova competência",
  POST_PROMOTION_VALIDATION: "Validando nova competência",
  ROLLING_BACK: "Restaurando competência anterior",
  SUCCEEDED: "Atualização concluída",
  ROLLED_BACK: "Atualização revertida",
  ROLLBACK_FAILED: "Recuperação operacional necessária",
};

const failures: Record<string, string> = {
  update_baseline_unknown: "A competência ativa usada como referência não pôde ser confirmada.",
  update_download_failed: "O download dos arquivos da nova competência não foi concluído.",
  update_generation_failed: "O processamento da nova competência não foi concluído.",
  candidate_large_decrease: "A nova geração apresentou uma redução acima do limite operacional e não foi promovida. A liberação excepcional permanece uma operação CLI.",
  candidate_ownership_invalid: "A geração candidata não pôde ser associada com segurança a esta atualização.",
  candidate_integrity_failed: "A geração candidata não passou pelas validações de integridade.",
  monthly_update_failed: "A atualização mensal não foi concluída.",
  promotion_retryable_failure: "A promoção não pôde ser concluída agora e aguarda uma nova tentativa do servidor.",
  post_promotion_validation_failed: "A nova competência falhou na validação posterior à promoção.",
  monthly_rollback_waiting: "O servidor está aguardando para restaurar a competência anterior.",
  monthly_rollback_failed: "Não foi possível restaurar automaticamente uma geração ativa válida.",
  lifecycle_jobs_inconsistent: "O estado operacional dos jobs da base está inconsistente.",
};

export const updateBlockerLabel = (code: string) => blockers[code] ?? "A atualização não pode ser iniciada neste momento.";
export const updateStageLabel = (stage: RuntimeUpdate["stage"]) => stage ? stages[stage] : "Preparando atualização";
export const updateFailureLabel = (code: string | null) => code ? failures[code] ?? "A atualização da base não foi concluída." : "A atualização da base não foi concluída.";

export const formatRuntimeTimestamp = (value: string | null, fallback = "Não informado") => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : fallback;

export const updatePreflightDetails = (data: UpdatePreflightResponse) => [
  ["Base atual", data.active_competence ? competenceLabel(data.active_competence) : "Não confirmada"],
  ["Nova competência", data.target_competence ? competenceLabel(data.target_competence) : "Não confirmada"],
  ["Download publicado", formatBytes(data.download_bytes, "Não informado")],
  ["Arquivos já disponíveis", formatBytes(data.reusable_bytes, "Não calculado")],
  ["Download restante", formatBytes(data.remaining_download_bytes, "Não calculado")],
  ["Espaço livre", formatBytes(data.free_bytes, "Não confirmado")],
  ["Espaço adicional do processamento", formatBytes(data.staging_estimate_bytes, "Não calculado")],
  ["Última verificação", formatRuntimeTimestamp(data.observed_at)],
] as const;

export function updateProgressDetails(update: RuntimeUpdate) {
  const progress = update.progress;
  return {
    bytes: progressPair(progress, "bytes_received", "bytes_total"),
    files: progressPair(progress, "file_index", "file_total"),
    items: progressPair(progress, "completed", "total"),
    shards: shardPair(progress),
    unit: progressUnitLabel(progress?.unit),
    internalStage: typeof progress?.stage === "string" ? progress.stage : null,
  };
}
