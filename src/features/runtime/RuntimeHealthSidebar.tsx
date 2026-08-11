import { Activity, ChevronDown, ChevronUp, Database, LoaderCircle, Server } from "lucide-react";
import { useState } from "react";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { presentRuntime } from "./runtimePresentation";

export function RuntimeHealthSidebar({ runtime }: { runtime: RuntimeLifecycleView }) {
  const [expanded, setExpanded] = useState(false);
  const presentation = presentRuntime(runtime);
  const panelId = "runtime-health-details";
  const initialPending = runtime.transportState === "pending" && runtime.runtime === null;
  const components = [
    { label: "API", value: presentation.api, Icon: initialPending ? LoaderCircle : Server },
    { label: "Banco", value: presentation.database, Icon: initialPending ? LoaderCircle : Database },
    { label: "Worker", value: presentation.worker, Icon: initialPending ? LoaderCircle : Activity },
  ];
  return <section className={`runtime-health runtime-health--${presentation.tone}`} aria-label="Saúde operacional">
    <div className="runtime-health__summary" aria-live="polite">
      <span className="runtime-health__label">{presentation.summary}</span>
      <button type="button" className="runtime-health__toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((value) => !value)}>
        <span className="sr-only">{expanded ? "Ocultar detalhes da saúde" : "Mostrar detalhes da saúde"}</span>
        {expanded ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
      </button>
    </div>
    {expanded && <div id={panelId} className="runtime-health__details">{components.map(({ label, value, Icon }) => <p key={label}><Icon className={initialPending ? "runtime-health__checking-icon" : "runtime-health__component-icon"} aria-hidden="true" size={16} /><span>{label}</span><strong>{value}</strong></p>)}</div>}
    {presentation.canRetry && <button type="button" className="runtime-health__retry" onClick={runtime.refreshNow} disabled={runtime.checking} aria-busy={runtime.checking}>Verificar novamente</button>}
  </section>;
}
