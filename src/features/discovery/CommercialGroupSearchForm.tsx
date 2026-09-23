import type { FormEvent, ReactNode } from "react";
import { SearchMoreFilters } from "./SearchMoreFilters";
import { SearchSubmitAction } from "./SearchSubmitAction";
import type {
  CommercialGroupFormValues,
  CommercialGroupValidationErrors,
} from "./commercialGroupTypes";

interface CommercialGroupSearchFormProps {
  values: CommercialGroupFormValues;
  errors: CommercialGroupValidationErrors;
  searching: boolean;
  options?: ReactNode;
  optionsFilled?: number;
  onChange: (field: keyof CommercialGroupFormValues, value: string) => void;
  onSubmit: () => void;
}

export function CommercialGroupSearchForm({
  values,
  errors,
  searching,
  options,
  optionsFilled = 0,
  onChange,
  onSubmit,
}: CommercialGroupSearchFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="discovery-form"
      aria-label="Formulário de busca por grupo comercial"
      onSubmit={submit}
      noValidate
    >
      <div className="form-grid commercial-group-field">
        <SearchSubmitAction searching={searching} label="Buscar grupo" />

        <div className="field-group field-group--wide">
          <label htmlFor="commercial-group-id">ID do grupo</label>
          <input
            id="commercial-group-id"
            name="group_id"
            type="text"
            value={values.groupId}
            onChange={(event) => onChange("groupId", event.target.value)}
            aria-invalid={Boolean(errors.groupId) || undefined}
            aria-describedby={
              errors.groupId
                ? "commercial-group-help commercial-group-error"
                : "commercial-group-help"
            }
          />
          <p id="commercial-group-help" className="field-message">
            Informe o identificador textual de um grupo previamente registrado
            no Sentinel.
          </p>
          {errors.groupId && (
            <p id="commercial-group-error" className="validation-message">
              {errors.groupId}
            </p>
          )}
        </div>
      </div>

      {options && <SearchMoreFilters filled={optionsFilled}>{options}</SearchMoreFilters>}
    </form>
  );
}
