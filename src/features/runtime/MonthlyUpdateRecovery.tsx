import type { RuntimeLifecycleView } from "./runtimeTypes";

export function MonthlyUpdateRecovery({ runtime }: { runtime: RuntimeLifecycleView }) {
  const retrying = runtime.runtime?.base.action_required === "RETRY_MONTHLY_ROLLBACK" || runtime.runtime?.update.stage === "ROLLING_BACK";
  return <section className="runtime-panel" role={retrying ? "status" : "alert"}>
    <h1>{retrying ? "Recuperação da atualização em andamento" : "A atualização exige recuperação operacional"}</h1>
    <p>{retrying ? "O Sentinel está tentando restaurar a competência anterior." : "Não foi possível comprovar uma geração ativa válida automaticamente."}</p>
    <button type="button" onClick={runtime.refreshNow} disabled={runtime.checking} aria-busy={runtime.checking}>Verificar novamente</button>
  </section>;
}
