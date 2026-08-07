import type { RuntimeLifecycleView } from "./runtimeTypes";

export type RuntimeSummaryLabel = "Verificação pendente" | "Configuração necessária" | "Sistema inicializando" | "Sistema disponível" | "Sistema com restrição" | "Sistema indisponível" | "Dados desatualizados";
export type RuntimeTone = "neutral" | "success" | "attention" | "danger";
export interface RuntimePresentation { summary: RuntimeSummaryLabel; tone: RuntimeTone; api: string; database: string; worker: string; canRetry: boolean; }

function componentLabels(view: RuntimeLifecycleView) {
  if (!view.runtime) {
    if (view.lastErrorCode === "database_unavailable") return { api: "Disponível", database: "Indisponível", worker: "Desconhecido" };
    return { api: "Indisponível", database: "Desconhecido", worker: "Desconhecido" };
  }
  const { components } = view.runtime;
  const api = view.transportState === "stale" ? "Desatualizado" : components.api.state === "AVAILABLE" ? "Disponível" : "Indisponível";
  const database = components.database.state === "AVAILABLE" && components.database.schema_current === true ? "Disponível" : components.database.state === "UNAVAILABLE" ? "Indisponível" : "Desconhecido";
  const worker = components.worker.state === "IDLE" ? "Disponível" : components.worker.state === "RUNNING" ? "Em execução" : components.worker.state === "STALE" ? "Sem confirmação recente" : components.worker.state === "UNAVAILABLE" ? "Indisponível" : "Desconhecido";
  return { api, database, worker };
}

export function presentRuntime(view: RuntimeLifecycleView): RuntimePresentation {
  const labels = componentLabels(view);
  if (view.transportState === "pending") return { summary: "Verificação pendente", tone: "neutral", ...labels, canRetry: false };
  if (view.transportState === "stale") return { summary: "Dados desatualizados", tone: "attention", ...labels, canRetry: true };
  if (!view.runtime) return { summary: "Sistema indisponível", tone: "danger", ...labels, canRetry: true };
  const { base, summary, components } = view.runtime;
  if (base.state === "EMPTY" || base.state === "AWAITING_OPERATOR") return { summary: "Configuração necessária", tone: "attention", ...labels, canRetry: view.transportState === "degraded" };
  if (["INITIALIZING", "DOWNLOADING", "PROCESSING", "LOADING", "VALIDATING"].includes(base.state ?? "")) return { summary: "Sistema inicializando", tone: "attention", ...labels, canRetry: view.transportState === "degraded" };
  const healthy = summary === "AVAILABLE" && base.state === "READY" && components.api.state === "AVAILABLE" && components.database.state === "AVAILABLE" && components.database.schema_current === true && components.worker.state === "IDLE";
  if (healthy && view.transportState === "fresh") return { summary: "Sistema disponível", tone: "success", ...labels, canRetry: false };
  if (summary === "UNAVAILABLE" && components.database.state === "UNAVAILABLE") return { summary: "Sistema indisponível", tone: "danger", ...labels, canRetry: true };
  return { summary: "Sistema com restrição", tone: "attention", ...labels, canRetry: true };
}
