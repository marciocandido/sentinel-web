import type { FormEvent, ReactNode } from "react";
import { SegmentSelect } from "../../components/SegmentSelect";
import type {
  RadiusFormValues,
  RadiusValidationErrors,
} from "./radiusTypes";

interface RadiusSearchFormProps {
  values: RadiusFormValues;
  errors: RadiusValidationErrors;
  searching: boolean;
  onChange: (field: keyof RadiusFormValues, value: string) => void;
  onSubmit: () => void;
}

export function RadiusSearchForm({
  values,
  errors,
  searching,
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="discovery-form"
      aria-label="Formulário de busca por raio"
      onSubmit={submit}
      noValidate
    >
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

      <div className="form-grid">
        {values.originKind === "municipality" && (
          <>
            {field("originMunicipioNome", "Nome do município")}
            {field("originUf", "UF da origem")}
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
        <div className="field-group">
          <label htmlFor="segment">
            Segmento <span className="optional-label">opcional</span>
          </label>
          <SegmentSelect
            value={values.segmentId}
            onChange={(value) => onChange("segmentId", value)}
          />
        </div>
        {field("resultUf", "UF dos resultados")}
      </div>

      <div className="search-actions">
        <button className="primary-button" type="submit" disabled={searching}>
          {searching ? "Buscando..." : "Buscar por raio"}
        </button>
        <p>Somente a origem selecionada será enviada.</p>
      </div>
    </form>
  );
}
