import type { BootstrapPreflightResponse } from "../../types/api";
import { blockerLabel, preflightDetails } from "./bootstrapPresentation";

export interface BootstrapSetupView {
  preflight: BootstrapPreflightResponse | null;
  loading: boolean;
  error: string | null;
  accepted: boolean;
  uncertain: boolean;
  reload: () => Promise<boolean>;
  verifyUncertain: () => Promise<void>;
}

export function PreflightDetails({ preflight }: { preflight: BootstrapPreflightResponse }) {
  return <dl>{preflightDetails(preflight).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function PreflightBlockers({ blockers }: { blockers: string[] }) {
  return <ul>{blockers.map((code) => {
    const label = blockerLabel(code);
    return <li key={code}>{label}{label !== "A preparação não está disponível no momento." && <small> Código: {code}</small>}</li>;
  })}</ul>;
}

export function BootstrapOnboarding({ setup, onPrepare }: { setup: BootstrapSetupView; onPrepare: () => void }) {
  const { preflight, loading, error, accepted, uncertain, reload, verifyUncertain } = setup;
  if (accepted) return <section className="runtime-panel" role="status"><h1>Solicitação recebida. Confirmando início da preparação...</h1></section>;
  if (uncertain) return <section className="runtime-panel" role="alert"><h1>Não foi possível confirmar se a preparação foi iniciada.</h1><p>Verifique o estado antes de tentar uma nova preparação.</p><button onClick={() => void verifyUncertain()} disabled={loading}>Verificar estado</button></section>;
  if (loading && !preflight) return <section className="runtime-panel" role="status"><h1>Verificando recursos para preparar a base</h1></section>;
  if (!preflight) return <section className="runtime-panel"><h1>Não foi possível confirmar a preparação</h1><button onClick={() => void reload()}>Verificar novamente</button></section>;
  return <section className="runtime-panel"><h1>Base da Receita ainda não preparada</h1><p>Confira a competência e os recursos necessários antes de iniciar a preparação.</p><PreflightDetails preflight={preflight} />{preflight.can_start ? <button onClick={onPrepare}>Preparar base</button> : <><PreflightBlockers blockers={preflight.blockers} /><button onClick={() => void reload()} disabled={loading}>Verificar novamente</button></>}{error && <p role="alert">Não foi possível atualizar as informações.</p>}</section>;
}
