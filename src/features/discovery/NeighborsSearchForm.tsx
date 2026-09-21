import type { FormEvent, ReactNode } from "react";
import { Search } from "lucide-react";
import { SegmentSelect } from "../../components/SegmentSelect";
import { UfSelect } from "../../components/UfSelect";
import { SearchMoreFilters } from "./SearchMoreFilters";
import type { NeighborsFormValues, NeighborsValidationErrors } from "./neighborsTypes";

interface Props { values: NeighborsFormValues; errors: NeighborsValidationErrors; searching: boolean; options?: ReactNode; optionsFilled?: number; onChange: (field: keyof NeighborsFormValues, value: string) => void; onSubmit: () => void; }

export function NeighborsSearchForm({ values, errors, searching, options, optionsFilled = 0, onChange, onSubmit }: Props) {
  const field = (fieldName: "cnpj" | "radiusKm" | "resultUf", label: string) => (
    <div className="field-group">
      <label htmlFor={`neighbors-${fieldName}`}>{label}</label>
      <input id={`neighbors-${fieldName}`} value={values[fieldName]} onChange={(event) => onChange(fieldName, event.target.value)} aria-invalid={Boolean(errors[fieldName]) || undefined} aria-describedby={errors[fieldName] ? `neighbors-${fieldName}-error` : undefined} />
      {errors[fieldName] && <p id={`neighbors-${fieldName}-error`} className="validation-message">{errors[fieldName]}</p>}
    </div>
  );
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(); };
  const filled = [values.segmentId, values.resultUf].filter((value) => value.trim() !== "").length + optionsFilled;
  return <form className="discovery-form" aria-label="Formulário de busca por vizinhos" onSubmit={submit} noValidate>
    <div className="form-grid">
      {field("cnpj", "CNPJ de referência")}
      {field("radiusKm", "Raio em quilômetros")}
    </div>
    <SearchMoreFilters filled={filled}>
      <div className="form-grid form-grid--tight">
        <div className="field-group"><label htmlFor="segment">Segmento <span className="optional-label">opcional</span></label><SegmentSelect value={values.segmentId} onChange={(value) => onChange("segmentId", value)} /></div>
        <div className="field-group">
          <label htmlFor="neighbors-resultUf">UF dos resultados — opcional</label>
          <UfSelect id="neighbors-resultUf" value={values.resultUf} onChange={(value) => onChange("resultUf", value)} />
        </div>
      </div>
      {options}
    </SearchMoreFilters>
    <div className="search-actions"><button className="primary-button" type="submit" disabled={searching}><Search aria-hidden="true" size={16} />{searching ? "Buscando..." : "Buscar vizinhos"}</button></div>
  </form>;
}
