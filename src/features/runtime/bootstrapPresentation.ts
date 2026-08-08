import type { BootstrapPreflightResponse, RuntimeBase } from "../../types/api";

export const formatBytes = (value: number | null, fallback: string) => {
  if (value === null) return fallback;
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toLocaleString("pt-BR", { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
};

export const competenceLabel = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : "Não confirmada";

const blockers: Record<string, string> = { source_unavailable: "Não foi possível confirmar a publicação disponível.", workspace_unavailable: "O espaço de trabalho do servidor não está disponível.", database_unavailable: "O banco do Sentinel está indisponível.", worker_unavailable: "O serviço de preparação da base não está disponível.", base_already_ready: "A base já está preparada.", base_initializing: "Já existe uma preparação em andamento.", lifecycle_unavailable: "O estado operacional da base ainda não permite esta ação.", job_active: "Já existe uma preparação em andamento.", lock_unavailable: "A preparação está temporariamente ocupada.", workspace_insufficient: "Não há espaço livre suficiente para iniciar a preparação." };
export const blockerLabel = (code: string) => blockers[code] ?? "A preparação não está disponível no momento.";

const stages: Record<string, string> = { VALIDATE_DOWNLOAD: "Verificando arquivos baixados", PREPARE_GEO_SOURCE: "Preparando referência geográfica", IMPORT_AUXILIARY: "Preparando cadastros auxiliares", IMPORT_EMPRESAS: "Processando empresas", IMPORT_ESTABELECIMENTOS: "Processando estabelecimentos", NORMALIZE_SECONDARY_CNAE: "Processando CNAEs secundários", LOAD_DUCKDB: "Consolidando base completa", BUILD_BASE_UTIL: "Construindo base útil", BUILD_GEO: "Aplicando geografia municipal", VALIDATE_GENERATION: "Validando geração processada", LOAD_BASE_UTIL: "Preparando carga", base_util_estabelecimento: "Carregando estabelecimentos", base_util_estabelecimento_segment_match: "Carregando vínculos de segmento", VALIDATE_MATERIALIZATION: "Validando base carregada" };
export const stageLabel = (stage: string | null, fallback = "Preparação da base") => stage ? stages[stage] ?? fallback : fallback;
export const failureLabel = (code: string | null) => code === "load_integrity_failed" ? "A validação da carga da base não foi concluída." : code === "bootstrap_failed" ? "A preparação foi interrompida antes de concluir." : "A preparação foi interrompida.";

export const safeNonNegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const safePositiveInteger = (value: unknown): value is number => safeNonNegativeInteger(value) && value > 0;
export const progressPair = (progress: Record<string, unknown> | null, a: string, b: string) => progress && safeNonNegativeInteger(progress[a]) && safePositiveInteger(progress[b]) && progress[a] <= progress[b] ? [progress[a] as number, progress[b] as number] as const : null;
export const shardPair = (progress: Record<string, unknown> | null) => progress && safePositiveInteger(progress.shard_index) && safePositiveInteger(progress.shard_total) && progress.shard_index <= progress.shard_total ? [progress.shard_index, progress.shard_total] as const : null;
export const progressUnitLabel = (value: unknown) => value === "rows" ? "registros" : null;
export const preflightDetails = (data: BootstrapPreflightResponse) => [["Competência disponível", competenceLabel(data.competence)], ["Arquivos", String(data.file_count)], ["Download publicado", formatBytes(data.download_bytes, "Não informado")], ["Arquivos já disponíveis", formatBytes(data.reusable_bytes, "Não calculado")], ["Download restante", formatBytes(data.remaining_download_bytes, "Não calculado")], ["Espaço livre", formatBytes(data.free_bytes, "Não confirmado")], ["Espaço adicional do processamento", formatBytes(data.workspace_estimate_bytes, "Não calculado")]] as const;
export const phaseIndex = (base: RuntimeBase) => ({ INITIALIZING: 0, DOWNLOADING: 1, PROCESSING: 2, LOADING: 3, VALIDATING: 4 } as Record<string, number>)[base.state ?? ""] ?? 0;
