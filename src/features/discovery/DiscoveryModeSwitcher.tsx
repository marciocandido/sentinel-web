import { Building2, Compass, Layers, Map, MapPin, Network, type LucideIcon } from "lucide-react";
import type { SearchMode } from "./discoveryTypes";

interface DiscoveryModeSwitcherProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}

const MODES: ReadonlyArray<readonly [SearchMode, string, LucideIcon]> = [
  ["segment", "Por segmento", Layers],
  ["region", "Por região", Map],
  ["radius", "Por raio", Compass],
  ["neighbors", "Por vizinhos", MapPin],
  ["root", "Por raiz/filiais", Building2],
  ["group", "Por grupo", Network],
];

export function DiscoveryModeSwitcher({
  mode,
  onChange,
}: DiscoveryModeSwitcherProps) {
  return (
    <fieldset className="mode-switcher">
      <legend>Modo de busca</legend>
      <div className="mode-switcher__options">
        {MODES.map(([value, label, Icon]) => (
          <label key={value} className="mode-option">
            <input
              type="radio"
              name="search-mode"
              value={value}
              checked={mode === value}
              onChange={() => onChange(value)}
            />
            <span className="mode-option__body">
              <Icon className="mode-option__icon" aria-hidden="true" size={18} />
              <span className="mode-option__label">{label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
