import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from "lucide-react";
import type { RuntimeComponentTone } from "./runtimePresentation";
import type { RuntimeLifecycleView } from "./runtimeTypes";
import { presentRuntime } from "./runtimePresentation";

const TONE_ICON = { checking: LoaderCircle, ok: CircleCheck, attention: TriangleAlert, danger: CircleX };

function ComponentStateIcon({ tone }: { tone: RuntimeComponentTone }) {
  const Icon = TONE_ICON[tone];
  const className = tone === "checking"
    ? "runtime-health__checking-icon"
    : `runtime-health__component-icon runtime-health__component-icon--${tone}`;
  return <Icon className={className} aria-hidden="true" size={15} />;
}

export function RuntimeHealthSidebar({ runtime }: { runtime: RuntimeLifecycleView }) {
  const presentation = presentRuntime(runtime);
  const components = [
    { label: "API", value: presentation.api, tone: presentation.tones.api },
    { label: "Banco", value: presentation.database, tone: presentation.tones.database },
    { label: "Worker", value: presentation.worker, tone: presentation.tones.worker },
  ];
  return <section className={`runtime-health runtime-health--${presentation.tone}`} aria-label="Saúde operacional">
    <p className="runtime-health__summary" aria-live="polite" title={presentation.summary}>
      <span className="runtime-health__dot" aria-hidden="true" />
      <span className="runtime-health__label">{presentation.summary}</span>
    </p>
    <ul className="runtime-health__components">
      {components.map(({ label, value, tone }) => <li key={label} className="runtime-health__component" title={`${label}: ${value}`}>
        <span className="runtime-health__component-label">{label}</span>
        <ComponentStateIcon tone={tone} />
        <span className="sr-only">{value}</span>
      </li>)}
    </ul>
    {presentation.canRetry && <button type="button" className="runtime-health__retry" onClick={runtime.refreshNow} disabled={runtime.checking} aria-busy={runtime.checking}>Verificar novamente</button>}
  </section>;
}
