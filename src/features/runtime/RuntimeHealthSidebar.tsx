import { Activity, ChevronDown, ChevronUp, Database, Server } from "lucide-react";
import { useState } from "react";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { presentRuntime } from "./runtimePresentation";

export function RuntimeHealthSidebar({ runtime }: { runtime: RuntimeLifecycleView }) {
  const [expanded, setExpanded] = useState(false);
  const presentation = presentRuntime(runtime);
  const panelId = "runtime-health-details";
  return <section className={`runtime-health runtime-health--${presentation.tone}`} aria-label="Saúde operacional">
    <div className="runtime-health__summary" aria-live="polite">
      <span className="runtime-health__label">{presentation.summary}</span>
      <button type="button" className="runtime-health__toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((value) => !value)}>
        <span className="sr-only">{expanded ? "Ocultar detalhes da saúde" : "Mostrar detalhes da saúde"}</span>
        {expanded ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
      </button>
    </div>
    {expanded && <div id={panelId} className="runtime-health__details">
      <p><Server aria-hidden="true" size={16} /><span>API</span><strong>{presentation.api}</strong></p>
      <p><Database aria-hidden="true" size={16} /><span>Banco</span><strong>{presentation.database}</strong></p>
      <p><Activity aria-hidden="true" size={16} /><span>Worker</span><strong>{presentation.worker}</strong></p>
    </div>}
    {presentation.canRetry && <button type="button" className="runtime-health__retry" onClick={runtime.refreshNow} disabled={runtime.checking} aria-busy={runtime.checking}>Verificar novamente</button>}
  </section>;
}
