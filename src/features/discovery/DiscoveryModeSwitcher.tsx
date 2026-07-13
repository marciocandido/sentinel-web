import type { SearchMode } from "./discoveryTypes";

export function DiscoveryModeSwitcher({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  return <fieldset className="mode-switcher"><legend>Modo de busca</legend>{([
    ["segment", "Por segmento"], ["region", "Por região"], ["radius", "Por raio"],
  ] as const).map(([value, label]) => <label key={value}><input type="radio" name="search-mode" value={value} checked={mode === value} onChange={() => onChange(value)} /><span>{label}</span></label>)}</fieldset>;
}
