import type { RuntimeLifecycleView } from "./runtimeTypes";

/**
 * Tom do indicador da competência da Receita. Cada tom depende de evidência
 * explícita do runtime: nenhum estado é inferido e `active_competence` sozinho
 * nunca basta para afirmar que a base está atualizada.
 */
export type BaseCompetenceTone = "ok" | "info" | "attention" | "danger" | "neutral";

export interface BaseCompetencePresentation {
  /** Competência ativa confirmada pelo backend, ou `null` quando não há evidência. */
  competence: string | null;
  tone: BaseCompetenceTone;
  /** Texto acessível que explica o motivo do tom. */
  note: string;
}

const PREPARING = new Set(["INITIALIZING", "DOWNLOADING", "PROCESSING", "LOADING", "VALIDATING"]);

export function presentBaseCompetence(view: RuntimeLifecycleView): BaseCompetencePresentation {
  const snapshot = view.runtime;
  if (!snapshot) {
    return view.transportState === "pending"
      ? { competence: null, tone: "neutral", note: "Competência da Receita ainda não confirmada: o estado do Sentinel está sendo verificado." }
      : { competence: null, tone: "danger", note: "Competência da Receita indisponível: não foi possível confirmar o estado do Sentinel." };
  }

  const { base, update } = snapshot;
  const competence = base.active_competence;
  const named = competence ? `Base da Receita na competência ${competence}.` : "Competência ativa da base da Receita não confirmada.";

  if (base.state === "UNAVAILABLE" || base.state === "FAILED" || base.state === null) {
    return { competence, tone: "danger", note: `${named} A base está indisponível para uso.` };
  }
  if (view.transportState === "stale" || view.transportState === "degraded") {
    return { competence, tone: "attention", note: `${named} O estado exibido está desatualizado e não confirma a competência vigente.` };
  }
  if (base.state === "EMPTY" || base.state === "AWAITING_OPERATOR" || PREPARING.has(base.state)) {
    return { competence, tone: "attention", note: `${named} A base ainda está sendo preparada pelo servidor.` };
  }
  if (update.status === "AUTHORIZED" || update.status === "RUNNING") {
    const target = update.target_competence;
    return { competence, tone: "info", note: `${named} Uma atualização${target ? ` para ${target}` : ""} está em andamento.` };
  }
  if (base.available_competence && base.available_competence !== competence) {
    return { competence, tone: "info", note: `${named} A Receita publicou a competência ${base.available_competence}.` };
  }
  if (update.status === "FAILED") {
    return { competence, tone: "attention", note: `${named} A última atualização não foi concluída.` };
  }
  if (update.status === "ROLLED_BACK") {
    return { competence, tone: "attention", note: `${named} A última atualização foi revertida.` };
  }
  if (base.last_metadata_check_result === "SOURCE_UNAVAILABLE") {
    return { competence, tone: "attention", note: `${named} Não foi possível verificar novas versões na Receita.` };
  }
  if (!competence) {
    return { competence, tone: "attention", note: `${named}` };
  }
  if (base.available_competence === competence) {
    return { competence, tone: "ok", note: `${named} A competência anunciada pela Receita já é a ativa.` };
  }
  if (base.last_metadata_check_result === "UP_TO_DATE") {
    return { competence, tone: "ok", note: `${named} A última verificação não encontrou uma nova competência.` };
  }
  if (update.status === "SUCCEEDED" && update.target_competence === competence) {
    return { competence, tone: "ok", note: `${named} A atualização para esta competência foi concluída.` };
  }
  return { competence, tone: "neutral", note: `${named} Não há verificação recente que confirme se existe uma competência mais nova.` };
}
