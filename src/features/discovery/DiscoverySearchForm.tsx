import type { FormEvent, ReactNode } from "react";
import { Search } from "lucide-react";
import { SegmentSelect } from "../../components/SegmentSelect";
import { SearchMoreFilters } from "./SearchMoreFilters";
import type {
  DiscoveryFormValues,
  SearchMode,
  ValidationErrors,
} from "./discoveryTypes";

interface DiscoverySearchFormProps {
  mode: SearchMode;
  values: DiscoveryFormValues;
  errors: ValidationErrors;
  searching: boolean;
  options?: ReactNode;
  optionsFilled?: number;
  onValueChange: (field: keyof DiscoveryFormValues, value: string) => void;
  onSubmit: () => void;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="validation-message">{message}</p>;
}

export function DiscoverySearchForm({
  mode,
  values,
  errors,
  searching,
  options,
  optionsFilled = 0,
  onValueChange,
  onSubmit,
}: DiscoverySearchFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const advancedValues = mode === "region"
    ? [values.codigoTom, values.codigoIbge]
    : [values.codigoTom, values.porteCodigo, values.capitalMin, values.capitalMax];
  const filled = advancedValues.filter((value) => value.trim() !== "").length + optionsFilled;

  return (
    <form className="discovery-form" aria-label="Formulário de busca" onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field-group">
          <label htmlFor="segment">
            Segmento {mode === "segment" ? <span aria-hidden="true">*</span> : <span className="optional-label">opcional</span>}
          </label>
          <SegmentSelect
            value={values.segmentId}
            onChange={(value) => onValueChange("segmentId", value)}
            invalid={Boolean(errors.segmentId)}
            describedBy={errors.segmentId ? "segment-error" : undefined}
          />
          <FieldError id="segment-error" message={errors.segmentId} />
        </div>

        <div className="field-group">
          <label htmlFor="uf">UF</label>
          <input
            id="uf"
            name="uf"
            value={values.uf}
            maxLength={2}
            autoComplete="address-level1"
            onChange={(event) => onValueChange("uf", event.target.value)}
            aria-describedby={mode === "region" && errors.region ? "region-error" : undefined}
          />
        </div>

        {mode === "region" && (
          <div className="field-group field-group--wide">
            <label htmlFor="municipio-nome">Nome do município</label>
            <input
              id="municipio-nome"
              name="municipio_nome"
              value={values.municipioNome}
              autoComplete="address-level2"
              onChange={(event) => onValueChange("municipioNome", event.target.value)}
              aria-describedby={errors.region ? "region-error" : undefined}
            />
          </div>
        )}
      </div>

      <SearchMoreFilters filled={filled}>
        <div className="form-grid form-grid--tight">
          <div className="field-group">
            <label htmlFor="codigo-tom">Código TOM</label>
            <input
              id="codigo-tom"
              name="codigo_tom"
              value={values.codigoTom}
              onChange={(event) => onValueChange("codigoTom", event.target.value)}
              aria-describedby={mode === "region" && errors.region ? "region-error" : undefined}
            />
          </div>

          {mode === "region" ? (
            <div className="field-group">
              <label htmlFor="codigo-ibge">Código IBGE</label>
              <input
                id="codigo-ibge"
                name="codigo_ibge"
                value={values.codigoIbge}
                onChange={(event) => onValueChange("codigoIbge", event.target.value)}
                aria-describedby={errors.region ? "region-error" : undefined}
              />
            </div>
          ) : (
            <>
              <div className="field-group">
                <label htmlFor="porte-codigo">Porte</label>
                <input
                  id="porte-codigo"
                  name="porte_codigo"
                  value={values.porteCodigo}
                  onChange={(event) => onValueChange("porteCodigo", event.target.value)}
                />
              </div>
              <div className="field-group">
                <label htmlFor="capital-min">Capital mínimo</label>
                <input
                  id="capital-min"
                  name="capital_min"
                  value={values.capitalMin}
                  inputMode="decimal"
                  onChange={(event) => onValueChange("capitalMin", event.target.value)}
                  aria-invalid={Boolean(errors.capitalMin) || undefined}
                  aria-describedby={errors.capitalMin ? "capital-min-error" : undefined}
                />
                <FieldError id="capital-min-error" message={errors.capitalMin} />
              </div>
              <div className="field-group">
                <label htmlFor="capital-max">Capital máximo</label>
                <input
                  id="capital-max"
                  name="capital_max"
                  value={values.capitalMax}
                  inputMode="decimal"
                  onChange={(event) => onValueChange("capitalMax", event.target.value)}
                  aria-invalid={Boolean(errors.capitalMax) || undefined}
                  aria-describedby={errors.capitalMax ? "capital-max-error" : undefined}
                />
                <FieldError id="capital-max-error" message={errors.capitalMax} />
              </div>
            </>
          )}
        </div>
        {options}
      </SearchMoreFilters>

      <FieldError id="region-error" message={errors.region} />

      <div className="search-actions">
        <button className="primary-button" type="submit" disabled={searching}>
          <Search aria-hidden="true" size={16} />
          {searching ? "Buscando..." : "Buscar"}
        </button>
        <p className="search-actions__note">Os resultados seguem a ordem definida pelo backend.</p>
      </div>
    </form>
  );
}
