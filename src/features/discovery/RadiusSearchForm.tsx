import type { FormEvent, ReactNode } from "react";
import { SegmentSelect } from "../../components/SegmentSelect";
import { UfSelect } from "../../components/UfSelect";
import { SearchMoreFilters } from "./SearchMoreFilters";
import { SearchSubmitAction } from "./SearchSubmitAction";
import type {
  RadiusFormValues,
  RadiusValidationErrors,
} from "./radiusTypes";

interface RadiusSearchFormProps {
  values: RadiusFormValues;
  errors: RadiusValidationErrors;
  searching: boolean;
  options?: ReactNode;
  optionsFilled?: number;
  onChange: (field: keyof RadiusFormValues, value: string) => void;
  onSubmit: () => void;
}

export function RadiusSearchForm({
  values,
  errors,
  searching,
  options,
  optionsFilled = 0,
  onChange,
  onSubmit,
}: RadiusSearchFormProps) {
  const field = (id: keyof RadiusFormValues, label: string): ReactNode => (
    <div className="field-group">
      <label htmlFor={`radius-${id}`}>{label}</label>
      <input
        id={`radius-${id}`}
        value={values[id]}
        onChange={(event) => onChange(id, event.target.value)}
        aria-invalid={Boolean(errors[id]) || undefined}
        aria-describedby={errors[id] ? `radius-${id}-error` : undefined}
      />
      {errors[id] && (
        <p id={`radius-${id}-error`} className="validation-message">
          {errors[id]}
        </p>
      )}
    </div>
  );

  const ufField = (id: "originUf" | "resultUf", label: string, emptyLabel: string): ReactNode => (
    <div className="field-group">
      <label htmlFor={`radius-${id}`}>{label}</label>
      <UfSelect
        id={`radius-${id}`}
        value={values[id]}
        emptyLabel={emptyLabel}
        invalid={Boolean(errors[id])}
        describedBy={errors[id] ? `radius-${id}-error` : undefined}
        onChange={(value) => onChange(id, value)}
      />
      {errors[id] && (
        <p id={`radius-${id}-error`} className="validation-message">
          {errors[id]}
        </p>
      )}
    </div>
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const filled = [values.segmentId, values.resultUf].filter((value) => value.trim() !== "").length + optionsFilled;

  return (
    <form
      className="discovery-form"
      aria-label="Formulário de busca por raio"
      onSubmit={submit}
      noValidate
    >
      <div className="form-grid">
        <SearchSubmitAction searching={searching} label="Buscar por raio" />

        <div className="field-group">
          <label htmlFor="radius-origin-kind">Tipo de origem</label>
          <select
            id="radius-origin-kind"
            value={values.originKind}
            onChange={(event) => onChange("originKind", event.target.value)}
          >
            <option value="municipality">Município</option>
            <option value="cnpj">CNPJ</option>
            <option value="tom">Código TOM</option>
            <option value="ibge">Código IBGE</option>
            <option value="coordinates">Coordenadas</option>
          </select>
        </div>

        {values.originKind === "municipality" && (
          <>
            {field("originMunicipioNome", "Nome do município")}
            {ufField("originUf", "UF da origem", "Selecione a UF")}
          </>
        )}
        {values.originKind === "cnpj" &&
          field("originCnpj", "CNPJ de origem")}
        {values.originKind === "tom" &&
          field("originCodigoTom", "Código TOM da origem")}
        {values.originKind === "ibge" &&
          field("originCodigoIbge", "Código IBGE da origem")}
        {values.originKind === "coordinates" && (
          <>
            {field("originLat", "Latitude")}
            {field("originLon", "Longitude")}
          </>
        )}
        {field("radiusKm", "Raio em quilômetros")}
      </div>

      <SearchMoreFilters filled={filled}>
        <div className="form-grid form-grid--tight">
          <div className="field-group">
            <label htmlFor="segment">
              Segmento <span className="optional-label">opcional</span>
            </label>
            <SegmentSelect
              value={values.segmentId}
              onChange={(value) => onChange("segmentId", value)}
            />
          </div>
          {ufField("resultUf", "UF dos resultados", "Todas")}
        </div>
        {options}
      </SearchMoreFilters>
    </form>
  );
}
