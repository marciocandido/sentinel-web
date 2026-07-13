import type { SearchMode } from "./discoveryTypes";

interface DiscoveryModeSwitcherProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}

const MODES: ReadonlyArray<readonly [SearchMode, string]> = [
  ["segment", "Por segmento"],
  ["region", "Por região"],
  ["radius", "Por raio"],
];

export function DiscoveryModeSwitcher({
  mode,
  onChange,
}: DiscoveryModeSwitcherProps) {
  return (
    <fieldset className="mode-switcher">
      <legend>Modo de busca</legend>
      {MODES.map(([value, label]) => (
        <label key={value}>
          <input
            type="radio"
            name="search-mode"
            value={value}
            checked={mode === value}
            onChange={() => onChange(value)}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
