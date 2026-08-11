import { useRef, useState } from "react";
import type { UpdatePreflightResponse } from "../../types/api";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { MonthlyUpdateConfirmDialog } from "./MonthlyUpdateConfirmDialog";
import { MonthlyUpdateProgress } from "./MonthlyUpdateProgress";
import { formatRuntimeTimestamp, updateBlockerLabel, updateFailureLabel, updatePreflightDetails, updateStageLabel } from "./monthlyUpdatePresentation";
import { useMonthlyUpdate } from "./useMonthlyUpdate";

function PreflightDetails({ preflight }: { preflight: UpdatePreflightResponse }) {
  return <dl>{updatePreflightDetails(preflight).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function PreflightBlockers({ blockers }: { blockers: string[] }) {
  const labels = [...new Set(blockers.map(updateBlockerLabel))];
  return <ul>{labels.map((label) => <li key={label}>{label}</li>)}</ul>;
}

function publicRequestError(code: string | null) {
  if (code === "database_unavailable") return "O banco do Sentinel está indisponível.";
  if (code === "invalid_request") return "A competência informada não é válida.";
  if (code === "update_blocked" || code === "update_conflict") return "A atualização não pode ser iniciada neste momento.";
  return "Não foi possível atualizar as condições da nova competência.";
}

export function MonthlyUpdatePanel({ runtime }: { runtime: RuntimeLifecycleView }) {
  const monthly = useMonthlyUpdate(runtime);
  const [confirm, setConfirm] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const snapshot = runtime.runtime;
  if (!snapshot || snapshot.base.state !== "READY") return null;
  const { base, update } = snapshot;
  const active = update.status === "AUTHORIZED" || update.status === "RUNNING";
  const openConfirm = () => {
    if (!monthly.preflight?.can_start || runtime.transportState !== "fresh") return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirm(true);
  };
  const closeConfirm = (restoreFocus = true) => {
    setConfirm(false);
    if (restoreFocus) queueMicrotask(() => { if (triggerRef.current?.isConnected) triggerRef.current.focus(); });
  };
  const confirmUpdate = async () => {
    const result = await monthly.start();
    if (result !== "in_progress") closeConfirm(result !== "accepted");
  };
  const dialog = confirm && monthly.preflight && <MonthlyUpdateConfirmDialog preflight={monthly.preflight} busy={monthly.submitting} onCancel={() => closeConfirm()} onConfirm={() => void confirmUpdate()} />;

  if (active) return <section className="monthly-update-panel monthly-update-panel--active" aria-labelledby="monthly-update-title">
    <h2 id="monthly-update-title">Atualização mensal da base</h2>
    <MonthlyUpdateProgress runtime={snapshot} transport={runtime.transportState} />
  </section>;

  if (monthly.uncertain) return <section className="monthly-update-panel monthly-update-panel--attention" role="alert" aria-labelledby="monthly-update-title">
    <h2 id="monthly-update-title">Autorização aguardando confirmação</h2>
    <p>Não foi possível confirmar se a atualização foi autorizada. Verifique o estado antes de qualquer nova tentativa.</p>
    <button type="button" onClick={monthly.verifyUncertain} disabled={runtime.checking} aria-busy={runtime.checking}>Verificar estado</button>
  </section>;

  if (monthly.accepted) return <section className="monthly-update-panel" role="status" aria-live="polite" aria-labelledby="monthly-update-title">
    <h2 id="monthly-update-title">Solicitação de atualização recebida</h2><p>Confirmando o início no servidor.</p>
  </section>;

  if (update.status === "FAILED") return <section className="monthly-update-panel monthly-update-panel--danger" aria-labelledby="monthly-update-title">
    {dialog}<div role="alert"><h2 id="monthly-update-title">A atualização não foi concluída</h2><p>A competência anterior continua disponível.</p><p>{updateFailureLabel(update.failure_code)}</p></div>
    <dl><div><dt>Base ativa</dt><dd>{base.active_competence ?? "Não confirmada"}</dd></div><div><dt>Tentativa</dt><dd>{update.target_competence ?? "Não confirmada"}</dd></div><div><dt>Etapa</dt><dd>{updateStageLabel(update.stage)}</dd></div><div><dt>Finalizada</dt><dd>{formatRuntimeTimestamp(update.finished_at)}</dd></div></dl>
    {runtime.transportState !== "fresh" ? <p className="monthly-update-panel__notice">Atualize o estado antes de autorizar uma nova tentativa.</p> : monthly.loadingPreflight && !monthly.preflight ? <p role="status">Verificando condições para uma nova tentativa...</p> : monthly.preflight ? <>{monthly.preflight.can_start ? <button type="button" onClick={openConfirm}>Tentar novamente</button> : <PreflightBlockers blockers={monthly.preflight.blockers} />}</> : <button type="button" onClick={() => void monthly.reload()}>Verificar novamente</button>}
  </section>;

  if (update.status === "ROLLED_BACK") return <section className="monthly-update-panel monthly-update-panel--attention" aria-labelledby="monthly-update-title" aria-live="polite">
    {dialog}<h2 id="monthly-update-title">Atualização revertida</h2><p>A competência anterior foi restaurada com sucesso.</p>
    <dl><div><dt>Base ativa</dt><dd>{base.active_competence ?? "Não confirmada"}</dd></div><div><dt>Tentativa</dt><dd>{update.target_competence ?? "Não confirmada"}</dd></div><div><dt>Rollback concluído</dt><dd>{formatRuntimeTimestamp(update.rolled_back_at)}</dd></div></dl>
    {monthly.preflight?.can_start && runtime.transportState === "fresh" && <button type="button" onClick={openConfirm}>Tentar novamente</button>}
  </section>;

  if (update.status === "SUCCEEDED" && !base.available_competence) return <section className="monthly-update-panel monthly-update-panel--success" aria-labelledby="monthly-update-title" aria-live="polite">
    <h2 id="monthly-update-title">Base da Receita atualizada</h2><dl><div><dt>Competência ativa</dt><dd>{base.active_competence ?? "Não confirmada"}</dd></div><div><dt>Promoção concluída</dt><dd>{formatRuntimeTimestamp(update.promoted_at)}</dd></div><div><dt>Atualização finalizada</dt><dd>{formatRuntimeTimestamp(update.finished_at)}</dd></div></dl>
  </section>;

  if (!monthly.target) {
    if (base.last_metadata_check_result !== "SOURCE_UNAVAILABLE") return null;
    return <section className="monthly-update-panel monthly-update-panel--attention" role="status" aria-labelledby="monthly-update-title"><h2 id="monthly-update-title">Verificação de novas versões</h2><p>Não foi possível verificar novas versões da base. A competência ativa continua disponível.</p></section>;
  }

  if (runtime.transportState !== "fresh") return <section className="monthly-update-panel monthly-update-panel--attention" aria-labelledby="monthly-update-title"><h2 id="monthly-update-title">Nova base da Receita disponível</h2><p>As informações estão desatualizadas. Verifique o estado antes de autorizar.</p><button type="button" onClick={runtime.refreshNow} disabled={runtime.checking} aria-busy={runtime.checking}>Verificar novamente</button></section>;
  if (monthly.loadingPreflight && !monthly.preflight) return <section className="monthly-update-panel" role="status" aria-labelledby="monthly-update-title"><h2 id="monthly-update-title">Nova base da Receita disponível</h2><p>Verificando recursos necessários...</p></section>;
  if (!monthly.preflight) return <section className="monthly-update-panel monthly-update-panel--attention" aria-labelledby="monthly-update-title"><h2 id="monthly-update-title">Nova base da Receita disponível</h2><p role="alert">{publicRequestError(monthly.error)}</p><button type="button" onClick={() => void monthly.reload()} disabled={monthly.loadingPreflight}>Verificar novamente</button></section>;
  return <section className="monthly-update-panel" aria-labelledby="monthly-update-title">
    {dialog}<h2 id="monthly-update-title">Nova base da Receita disponível</h2><PreflightDetails preflight={monthly.preflight} />
    {monthly.preflight.can_start ? <button type="button" onClick={openConfirm}>Atualizar agora</button> : <><PreflightBlockers blockers={monthly.preflight.blockers} /><button type="button" onClick={() => void monthly.reload()} disabled={monthly.loadingPreflight}>Verificar novamente</button></>}
  </section>;
}
