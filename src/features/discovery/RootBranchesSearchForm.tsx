import type { FormEvent } from "react";
import type {
  RootBranchesFormValues,
  RootBranchesValidationErrors,
} from "./rootBranchesTypes";

interface RootBranchesSearchFormProps {
  values: RootBranchesFormValues;
  errors: RootBranchesValidationErrors;
  searching: boolean;
  onChange: <Field extends keyof RootBranchesFormValues>(
    field: Field,
    value: RootBranchesFormValues[Field],
  ) => void;
  onSubmit: () => void;
}

export function RootBranchesSearchForm({
  values,
  errors,
  searching,
  onChange,
  onSubmit,
}: RootBranchesSearchFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const label =
    values.identifierKind === "cnpj" ? "CNPJ completo" : "Raiz do CNPJ";

  return (
    <form
      className="discovery-form"
      aria-label="Formulário de busca por raiz e filiais"
      onSubmit={submit}
      noValidate
    >
      <fieldset className="root-identifier-kind">
        <legend>Tipo de identificador</legend>
        <label>
          <input
            type="radio"
            name="root-identifier-kind"
            value="cnpj"
            checked={values.identifierKind === "cnpj"}
            onChange={() => onChange("identifierKind", "cnpj")}
          />
          <span>CNPJ completo</span>
        </label>
        <label>
          <input
            type="radio"
            name="root-identifier-kind"
            value="root"
            checked={values.identifierKind === "root"}
            onChange={() => onChange("identifierKind", "root")}
          />
          <span>Raiz do CNPJ</span>
        </label>
      </fieldset>

      <div className="form-grid root-identifier-field">
        <div className="field-group field-group--wide">
          <label htmlFor="root-identifier-value">{label}</label>
          <input
            id="root-identifier-value"
            name="root_identifier_value"
            type="text"
            value={values.identifierValue}
            onChange={(event) =>
              onChange("identifierValue", event.target.value)
            }
            aria-invalid={Boolean(errors.identifierValue) || undefined}
            aria-describedby={
              errors.identifierValue
                ? "root-identifier-help root-identifier-error"
                : "root-identifier-help"
            }
          />
          <p id="root-identifier-help" className="field-message">
            A API validará e normalizará o identificador. O frontend preserva
            o valor como texto.
          </p>
          {errors.identifierValue && (
            <p id="root-identifier-error" className="validation-message">
              {errors.identifierValue}
            </p>
          )}
        </div>
      </div>

      <div className="search-actions">
        <button className="primary-button" type="submit" disabled={searching}>
          {searching ? "Buscando..." : "Buscar raiz e filiais"}
        </button>
        <p>Os resultados seguem a ordem definida pelo backend.</p>
      </div>
    </form>
  );
}
