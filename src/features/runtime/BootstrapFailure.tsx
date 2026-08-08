import type { RuntimeStatusResponse } from "../../types/api";
import { failureLabel, stageLabel } from "./bootstrapPresentation";
import { PreflightBlockers, PreflightDetails, type BootstrapSetupView } from "./BootstrapOnboarding";

export function BootstrapFailure({ runtime, setup, onPrepare }: { runtime: RuntimeStatusResponse; setup: BootstrapSetupView; onPrepare: () => void }) {
  const { preflight, loading, uncertain, verifyUncertain, reload } = setup;
  const knownCode = runtime.base.last_failure_code === "bootstrap_failed" || runtime.base.last_failure_code === "load_integrity_failed";
  return <section className="runtime-panel"><h1>A preparação da base não foi concluída</h1><p>Etapa: {stageLabel(runtime.base.current_stage)}</p><p>{failureLabel(runtime.base.last_failure_code)}</p>{knownCode && <small>Código: {runtime.base.last_failure_code}</small>}{uncertain ? <><p role="alert">Não foi possível confirmar se a preparação foi iniciada.</p><button onClick={() => void verifyUncertain()} disabled={loading}>Verificar estado</button></> : loading && !preflight ? <p role="status">Verificando condições para uma nova tentativa...</p> : !preflight ? <button onClick={() => void reload()}>Verificar novamente</button> : <><PreflightDetails preflight={preflight} />{preflight.can_start ? <button onClick={onPrepare}>Tentar novamente</button> : <><PreflightBlockers blockers={preflight.blockers} /><button onClick={() => void reload()} disabled={loading}>Verificar novamente</button></>}</>}</section>;
}
