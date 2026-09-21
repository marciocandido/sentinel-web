import type { RuntimeLifecycleView } from "./runtimeTypes";

export type RuntimeSummaryLabel = "Verificação pendente" | "Configuração necessária" | "Sistema inicializando" | "Sistema disponível" | "Sistema com restrição" | "Sistema indisponível" | "Dados desatualizados";
export type RuntimeTone = "neutral" | "success" | "attention" | "danger";
export type RuntimeComponentTone = "checking" | "ok" | "attention" | "danger";
export interface RuntimeComponentTones { api: RuntimeComponentTone; database: RuntimeComponentTone; worker: RuntimeComponentTone; }
export interface RuntimePresentation { summary: RuntimeSummaryLabel; tone: RuntimeTone; api: string; database: string; worker: string; tones: RuntimeComponentTones; canRetry: boolean; }

interface ComponentView { label: string; tone: RuntimeComponentTone; }
type ComponentViews = Record<"api" | "database" | "worker", ComponentView>;

const uniform = (label: string, tone: RuntimeComponentTone): ComponentViews => ({ api: { label, tone }, database: { label, tone }, worker: { label, tone } });

function componentViews(view: RuntimeLifecycleView): ComponentViews {
  if (view.transportState === "stale") return uniform("Desatualizado", "attention");
  if (!view.runtime) {
    if (view.transportState === "pending") return uniform("Verificando", "checking");
    if (view.lastErrorCode === "database_unavailable") {
      return { api: { label: "Disponível", tone: "ok" }, database: { label: "Indisponível", tone: "danger" }, worker: { label: "Desconhecido", tone: "danger" } };
    }
    return { api: { label: "Indisponível", tone: "danger" }, database: { label: "Desconhecido", tone: "danger" }, worker: { label: "Desconhecido", tone: "danger" } };
  }
  const { components, update } = view.runtime;
  const api: ComponentView = components.api.state === "AVAILABLE"
    ? { label: "Disponível", tone: "ok" }
    : { label: "Indisponível", tone: "danger" };
  const database: ComponentView = components.database.state === "AVAILABLE" && components.database.schema_current === true
    ? { label: "Disponível", tone: "ok" }
    : components.database.state === "UNAVAILABLE"
      ? { label: "Indisponível", tone: "danger" }
      : { label: "Desconhecido", tone: "attention" };
  const updating = update.status === "AUTHORIZED" || update.status === "RUNNING";
  const worker: ComponentView = updating
    ? { label: update.stage === "PROMOTION_WAITING" && components.worker.state === "IDLE" ? "Atualização aguardando retomada" : "Atualizando base", tone: "attention" }
    : components.worker.state === "IDLE"
      ? { label: "Disponível", tone: "ok" }
      : components.worker.state === "RUNNING"
        ? { label: "Em execução", tone: "attention" }
        : components.worker.state === "STALE"
          ? { label: "Sem confirmação recente", tone: "attention" }
          : components.worker.state === "UNAVAILABLE"
            ? { label: "Indisponível", tone: "danger" }
            : { label: "Desconhecido", tone: "attention" };
  return { api, database, worker };
}

export function presentRuntime(view: RuntimeLifecycleView): RuntimePresentation {
  const views = componentViews(view);
  const labels = {
    api: views.api.label,
    database: views.database.label,
    worker: views.worker.label,
    tones: { api: views.api.tone, database: views.database.tone, worker: views.worker.tone },
  };
  if (view.transportState === "pending") return { summary: "Verificação pendente", tone: "neutral", ...labels, canRetry: false };
  if (view.transportState === "stale") return { summary: "Dados desatualizados", tone: "attention", ...labels, canRetry: true };
  if (!view.runtime) return { summary: "Sistema indisponível", tone: "danger", ...labels, canRetry: true };
  const { base, summary, components } = view.runtime;
  if (base.state === "EMPTY" || base.state === "AWAITING_OPERATOR") return { summary: "Configuração necessária", tone: "attention", ...labels, canRetry: view.transportState === "degraded" };
  if (["INITIALIZING", "DOWNLOADING", "PROCESSING", "LOADING", "VALIDATING"].includes(base.state ?? "")) return { summary: "Sistema inicializando", tone: "attention", ...labels, canRetry: view.transportState === "degraded" };
  const updateKeepsBaseAvailable = view.runtime.update.status === "AUTHORIZED" || view.runtime.update.status === "RUNNING";
  const workerCompatible = components.worker.state === "IDLE" || (updateKeepsBaseAvailable && components.worker.state === "RUNNING");
  const healthy = summary === "AVAILABLE" && base.state === "READY" && components.api.state === "AVAILABLE" && components.database.state === "AVAILABLE" && components.database.schema_current === true && workerCompatible && view.runtime.update.status !== "FAILED";
  if (healthy && view.transportState === "fresh") return { summary: "Sistema disponível", tone: "success", ...labels, canRetry: false };
  if (summary === "UNAVAILABLE" && components.database.state === "UNAVAILABLE") return { summary: "Sistema indisponível", tone: "danger", ...labels, canRetry: true };
  return { summary: "Sistema com restrição", tone: "attention", ...labels, canRetry: true };
}
