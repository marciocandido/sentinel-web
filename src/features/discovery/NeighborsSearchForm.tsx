import type { FormEvent } from "react";
import { SegmentSelect } from "../../components/SegmentSelect";
import type { NeighborsFormValues, NeighborsValidationErrors } from "./neighborsTypes";

interface Props { values: NeighborsFormValues; errors: NeighborsValidationErrors; searching: boolean; onChange: (field: keyof NeighborsFormValues, value: string) => void; onSubmit: () => void; }

export function NeighborsSearchForm({ values, errors, searching, onChange, onSubmit }: Props) {
  const field = (fieldName: "cnpj" | "radiusKm" | "resultUf", label: string) => (
    <div className="field-group">
      <label htmlFor={`neighbors-${fieldName}`}>{label}</label>
      <input id={`neighbors-${fieldName}`} value={values[fieldName]} onChange={(event) => onChange(fieldName, event.target.value)} aria-invalid={Boolean(errors[fieldName]) || undefined} aria-describedby={errors[fieldName] ? `neighbors-${fieldName}-error` : undefined} />
      {errors[fieldName] && <p id={`neighbors-${fieldName}-error`} className="validation-message">{errors[fieldName]}</p>}
    </div>
  );
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(); };
  return <form className="discovery-form" aria-label="Formulário de busca por vizinhos" onSubmit={submit} noValidate>
    <div className="form-grid">
      {field("cnpj", "CNPJ de referência")}
      {field("radiusKm", "Raio em quilômetros")}
      <div className="field-group"><label htmlFor="segment">Segmento <span className="optional-label">opcional</span></label><SegmentSelect value={values.segmentId} onChange={(value) => onChange("segmentId", value)} /></div>
      {field("resultUf", "UF dos resultados — opcional")}
    </div>
    <div className="search-actions"><button className="primary-button" type="submit" disabled={searching}>{searching ? "Buscando..." : "Buscar vizinhos"}</button></div>
  </form>;
}
