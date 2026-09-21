import { UF_OPTIONS } from "./ufOptions";

const KNOWN = new Set(UF_OPTIONS.map(([code]) => code));

interface UfSelectProps {
  id: string;
  name?: string;
  value: string;
  emptyLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

export function UfSelect({
  id,
  name,
  value,
  emptyLabel = "Todas",
  invalid,
  describedBy,
  onChange,
}: UfSelectProps) {
  /**
   * Um valor fora da lista — vindo de uma pesquisa salva antiga, por exemplo —
   * continua selecionável em vez de ser descartado em silêncio.
   */
  const unlisted = value !== "" && !KNOWN.has(value);
  return (
    <select
      id={id}
      name={name}
      value={value}
      autoComplete="address-level1"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {unlisted && <option value={value}>{value}</option>}
      {UF_OPTIONS.map(([code, label]) => (
        <option key={code} value={code}>
          {code} — {label}
        </option>
      ))}
    </select>
  );
}
