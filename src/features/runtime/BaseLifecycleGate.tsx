import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { DiscoveryLanding } from "../discovery/DiscoveryLanding";
import { MonthlyUpdatePanel } from "./MonthlyUpdatePanel";
import { MonthlyUpdateRecovery } from "./MonthlyUpdateRecovery";
import { BootstrapConfirmDialog } from "./BootstrapConfirmDialog";
import { BootstrapFailure } from "./BootstrapFailure";
import { BootstrapOnboarding } from "./BootstrapOnboarding";
import { BootstrapProgress } from "./BootstrapProgress";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { useBootstrapSetup } from "./useBootstrapSetup";

const progressStates = new Set(["INITIALIZING", "DOWNLOADING", "PROCESSING", "LOADING", "VALIDATING"]);

export function BaseLifecycleGate({ runtime }: { runtime: RuntimeLifecycleView }) {
  const state = runtime.runtime?.base.state;
  const monthlyRecovery = state === "FAILED" && (
    runtime.runtime?.base.action_required === "RETRY_MONTHLY_ROLLBACK" ||
    runtime.runtime?.base.action_required === "MANUAL_MONTHLY_ROLLBACK" ||
    runtime.runtime?.update.stage === "ROLLING_BACK" ||
    runtime.runtime?.update.stage === "ROLLBACK_FAILED"
  );
  const setup = useBootstrapSetup(state === "AWAITING_OPERATOR" || (state === "FAILED" && !monthlyRecovery) ? state : null, runtime.confirmationVersion, runtime.refreshNow);
  const [confirm, setConfirm] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const previous = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (previous.current && previous.current !== "READY" && state === "READY") {
      setAnnouncement("Base da Receita preparada. Discovery disponível.");
    }
    previous.current = state ?? null;
  }, [state]);

  const openConfirm = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirm(true);
  };
  const closeConfirm = (restoreFocus = true) => {
    setConfirm(false);
    if (restoreFocus) queueMicrotask(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    });
  };
  const prepare = async () => {
    if (!setup.preflight) return;
    const result = await setup.start(setup.preflight.competence);
    if (result !== "in_progress") closeConfirm(result !== "accepted");
  };

  if (!runtime.runtime) {
    if (runtime.transportState === "pending") return <section className="runtime-panel runtime-panel--loading" role="status" aria-live="polite" aria-busy="true"><LoaderCircle className="runtime-panel__spinner" aria-hidden="true" /><div><h1>Verificando estado do Sentinel</h1><p>Confirmando API, banco, worker e base da Receita…</p></div></section>;
    return <section className="runtime-panel"><h1>Não foi possível confirmar o estado da base</h1><button onClick={runtime.refreshNow}>Verificar novamente</button></section>;
  }
  if (state === "READY") return <><p className="sr-only" aria-live="polite">{announcement}</p><MonthlyUpdatePanel runtime={runtime} /><DiscoveryLanding onLifecycleError={() => runtime.refreshNow()} /></>;
  if (state === "EMPTY") return <section className="runtime-panel" role="status"><h1>Inicializando configuração do Sentinel</h1><p>O estado da base ainda está sendo preparado pelo servidor.</p></section>;
  if (state === "UNAVAILABLE" || state === null) return <section className="runtime-panel"><h1>Não foi possível confirmar o estado da base</h1><button onClick={runtime.refreshNow}>Verificar novamente</button></section>;

  const dialog = confirm && setup.preflight && <BootstrapConfirmDialog competence={setup.preflight.competence} download={setup.preflight.download_bytes} reusable={setup.preflight.reusable_bytes} remaining={setup.preflight.remaining_download_bytes} busy={setup.loading} retry={state === "FAILED"} onCancel={() => closeConfirm()} onConfirm={() => void prepare()} />;
  if (state === "AWAITING_OPERATOR") return <>{dialog}<BootstrapOnboarding setup={setup} onPrepare={openConfirm} /></>;
  if (state === "FAILED" && monthlyRecovery) return <MonthlyUpdateRecovery runtime={runtime} />;
  if (state === "FAILED") return <>{dialog}<BootstrapFailure runtime={runtime.runtime} setup={setup} onPrepare={openConfirm} /></>;
  if (state && progressStates.has(state)) return <BootstrapProgress runtime={runtime.runtime} transport={runtime.transportState} />;
  return <section className="runtime-panel"><h1>Não foi possível confirmar o estado da base</h1><button onClick={runtime.refreshNow}>Verificar novamente</button></section>;
}
