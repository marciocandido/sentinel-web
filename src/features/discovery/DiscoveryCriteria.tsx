import { ChevronDown, ChevronUp, MapPin, Network, Search, SlidersHorizontal, Undo2, type LucideIcon } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { SegmentSelect } from "../../components/SegmentSelect";
import type { SegmentCatalog } from "../../components/segmentCatalog";
import { UfSelect } from "../../components/UfSelect";
import type { CommercialGroupFormValues, CommercialGroupValidationErrors } from "./commercialGroupTypes";
import type { DraftChange } from "./discoveryQuery";
import type {
  DiscoveryDraft,
  DiscoveryFamily,
  DiscoveryFormValues,
  ProximityType,
  StructureType,
  ValidationErrors,
} from "./discoveryTypes";
import type { NeighborsFormValues, NeighborsValidationErrors } from "./neighborsTypes";
import type { RadiusFormValues, RadiusOriginKind, RadiusValidationErrors } from "./radiusTypes";
import type { RootBranchesFormValues, RootBranchesValidationErrors } from "./rootBranchesTypes";

export interface CriteriaErrors {
  filtered?: ValidationErrors;
  radius?: RadiusValidationErrors;
  neighbors?: NeighborsValidationErrors;
  root?: RootBranchesValidationErrors;
  group?: CommercialGroupValidationErrors;
}

export interface DiscoveryCriteriaProps {
  draft: DiscoveryDraft;
  errors: CriteriaErrors;
  /** Diferenças do rascunho visível em relação à consulta submetida. */
  changes: DraftChange[] | null;
  searching: boolean;
  catalog: SegmentCatalog;
  notice: string | null;
  onFamilyChange: (family: DiscoveryFamily) => void;
  onProximityTypeChange: (type: ProximityType) => void;
  onStructureTypeChange: (type: StructureType) => void;
  onFiltersChange: (field: keyof DiscoveryFormValues, value: string) => void;
  onRadiusChange: (field: keyof RadiusFormValues, value: string) => void;
  onNeighborsChange: (field: keyof NeighborsFormValues, value: string) => void;
  onRootChange: <Field extends keyof RootBranchesFormValues>(field: Field, value: RootBranchesFormValues[Field]) => void;
  onGroupChange: (field: keyof CommercialGroupFormValues, value: string) => void;
  onIncludeDiscardedChange: (value: boolean) => void;
  onUndo: () => void;
  onSubmit: () => void;
}

const FAMILIES: ReadonlyArray<readonly [DiscoveryFamily, string, string, LucideIcon]> = [
  ["filters", "Filtros", "Segmento, UF, município, porte e capital", SlidersHorizontal],
  ["proximity", "Proximidade", "Empresas num raio a partir de uma origem", MapPin],
  ["structure", "Estrutura", "Raiz e filiais ou grupo comercial registrado", Network],
];

const ORIGINS: ReadonlyArray<readonly [RadiusOriginKind, string]> = [
  ["municipality", "Município"],
  ["cnpj", "CNPJ"],
  ["tom", "Código TOM"],
  ["ibge", "Código IBGE"],
  ["coordinates", "Coordenadas"],
];

interface FieldA11y {
  id: string;
  describedBy?: string;
  invalid?: true;
}

interface FieldProps {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** Valor pesquisado quando o campo mudou depois da submissão. */
  changed?: string;
  extraDescribedBy?: string;
  wide?: boolean;
  children: (a11y: FieldA11y) => ReactNode;
}

function Field({ id, label, optional, hint, error, changed, extraDescribedBy, wide, children }: FieldProps) {
  const describedBy = [
    changed !== undefined ? `${id}-changed` : null,
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
    extraDescribedBy ?? null,
  ].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field-group${wide ? " field-group--wide" : ""}${changed !== undefined ? " field-group--changed" : ""}`}>
      <div className="field-label-row">
        <label htmlFor={id}>
          {label}
          {optional && " "}
          {optional && <span className="optional-label">(opcional)</span>}
        </label>
        {changed !== undefined && <span className="changed-badge">alterado</span>}
      </div>
      {children({ id, describedBy, invalid: error ? true : undefined })}
      {changed !== undefined && <p id={`${id}-changed`} className="changed-hint">Pesquisado: {changed}</p>}
      {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="validation-message">{error}</p>}
    </div>
  );
}

function TextInput({ a11y, value, onChange, placeholder, inputMode, autoComplete }: {
  a11y: FieldA11y;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "text";
  autoComplete?: string;
}) {
  return (
    <input
      id={a11y.id}
      type="text"
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete ?? "off"}
      aria-invalid={a11y.invalid}
      aria-describedby={a11y.describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ChoiceGroup<T extends string>({ label, name, value, options, onChange, variant, hint }: {
  label: string;
  name: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
  variant: "segmented" | "chips";
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="choice-field">
      <p className="choice-field__label" id={`${id}-label`}>{label}</p>
      <div
        className={`choice-group choice-group--${variant}`}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
      >
        {options.map(([optionValue, optionLabel]) => (
          <label key={optionValue} className="choice-option">
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
      {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
    </div>
  );
}

function FamilySwitcher({ family, onChange }: { family: DiscoveryFamily; onChange: (family: DiscoveryFamily) => void }) {
  return (
    <div className="family-switcher" role="radiogroup" aria-label="Tipo de busca">
      {FAMILIES.map(([value, label, description, Icon]) => (
        <label key={value} className="family-option">
          <input
            type="radio"
            name="discovery-family"
            value={value}
            checked={family === value}
            aria-labelledby={`family-${value}-label`}
            aria-describedby={`family-${value}-description`}
            onChange={() => onChange(value)}
          />
          <span className="family-option__body">
            <Icon className="family-option__icon" aria-hidden="true" size={18} />
            <span className="family-option__text">
              <span id={`family-${value}-label`} className="family-option__label">{label}</span>
              <span id={`family-${value}-description`} className="family-option__description">{description}</span>
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

type ChangedLookup = (key: string) => string | undefined;

function FiltersMain({ values, errors, changed, catalog, onChange }: {
  values: DiscoveryFormValues;
  errors: ValidationErrors;
  changed: ChangedLookup;
  catalog: SegmentCatalog;
  onChange: DiscoveryCriteriaProps["onFiltersChange"];
}) {
  const groupError = errors.filters ? "filters-error" : undefined;
  return (
    <>
      <div className="criteria-grid criteria-grid--3">
        <Field id="segment" label="Segmento" optional changed={changed("segmentId")} extraDescribedBy={groupError}>
          {(a11y) => (
            <SegmentSelect
              catalog={catalog}
              id={a11y.id}
              value={values.segmentId}
              describedBy={a11y.describedBy}
              onChange={(value) => onChange("segmentId", value)}
            />
          )}
        </Field>
        <Field id="uf" label="UF" optional changed={changed("uf")} extraDescribedBy={groupError}>
          {(a11y) => <UfSelect id={a11y.id} name="uf" value={values.uf} describedBy={a11y.describedBy} onChange={(value) => onChange("uf", value)} />}
        </Field>
        <Field id="municipio-nome" label="Município" optional hint="Nome exato. Sem busca aproximada." changed={changed("municipioNome")} extraDescribedBy={groupError}>
          {(a11y) => <TextInput a11y={a11y} value={values.municipioNome} placeholder="Ex.: Diadema" autoComplete="address-level2" onChange={(value) => onChange("municipioNome", value)} />}
        </Field>
      </div>
      {errors.filters && <p id="filters-error" className="validation-message criteria-error">{errors.filters}</p>}
    </>
  );
}

function FiltersMore({ values, errors, changed, onChange }: {
  values: DiscoveryFormValues;
  errors: ValidationErrors;
  changed: ChangedLookup;
  onChange: DiscoveryCriteriaProps["onFiltersChange"];
}) {
  const text = (id: string, field: keyof DiscoveryFormValues, label: string, hint?: string, decimal = false) => (
    <Field id={id} label={label} optional hint={hint} error={errors[field]} changed={changed(field)}>
      {(a11y) => (
        <TextInput
          a11y={a11y}
          value={values[field]}
          inputMode={decimal ? "decimal" : "text"}
          onChange={(value) => onChange(field, value)}
        />
      )}
    </Field>
  );
  return (
    <div className="criteria-grid criteria-grid--5">
      {text("codigo-tom", "codigoTom", "Código TOM")}
      {text("codigo-ibge", "codigoIbge", "Código IBGE")}
      {text("porte-codigo", "porteCodigo", "Porte", "Código Receita, ex.: 03.")}
      {text("capital-min", "capitalMin", "Capital mínimo", "R$, ponto decimal.", true)}
      {text("capital-max", "capitalMax", "Capital máximo", "R$, ponto decimal.", true)}
    </div>
  );
}

function RadiusMain({ values, errors, changed, catalog, onChange }: {
  values: RadiusFormValues;
  errors: RadiusValidationErrors;
  changed: ChangedLookup;
  catalog: SegmentCatalog;
  onChange: DiscoveryCriteriaProps["onRadiusChange"];
}) {
  const text = (field: keyof RadiusFormValues, label: string, hint?: string, placeholder?: string) => (
    <Field id={`radius-${field}`} label={label} hint={hint} error={errors[field]} changed={changed(field)}>
      {(a11y) => <TextInput a11y={a11y} value={values[field]} placeholder={placeholder} onChange={(value) => onChange(field, value)} />}
    </Field>
  );
  return (
    <>
      <ChoiceGroup
        label="Origem"
        name="radius-origin-kind"
        value={values.originKind}
        options={ORIGINS}
        variant="chips"
        onChange={(value) => onChange("originKind", value)}
      />
      {changed("originKind") !== undefined && (
        <p className="changed-hint">Origem alterada · pesquisado: {changed("originKind")}</p>
      )}
      <div className="criteria-grid criteria-grid--4">
        {values.originKind === "municipality" && (
          <>
            {text("originMunicipioNome", "Município de origem", "Nome exato.", "Ex.: Diadema")}
            <Field id="radius-originUf" label="UF da origem" error={errors.originUf} changed={changed("originUf")}>
              {(a11y) => (
                <UfSelect
                  id={a11y.id}
                  value={values.originUf}
                  emptyLabel="Selecione a UF"
                  invalid={a11y.invalid}
                  describedBy={a11y.describedBy}
                  onChange={(value) => onChange("originUf", value)}
                />
              )}
            </Field>
          </>
        )}
        {values.originKind === "cnpj" && text("originCnpj", "CNPJ de origem", "Aceita letras e números; zeros preservados. Pode incluir a própria origem.")}
        {values.originKind === "tom" && text("originCodigoTom", "Código TOM da origem")}
        {values.originKind === "ibge" && text("originCodigoIbge", "Código IBGE da origem")}
        {values.originKind === "coordinates" && (
          <>
            {text("originLat", "Latitude", undefined, "Ex.: -23.68")}
            {text("originLon", "Longitude", undefined, "Ex.: -46.62")}
          </>
        )}
        {text("radiusKm", "Raio (km)")}
        <Field id="radius-segment" label="Segmento" optional changed={changed("segmentId")}>
          {(a11y) => <SegmentSelect catalog={catalog} id={a11y.id} value={values.segmentId} describedBy={a11y.describedBy} onChange={(value) => onChange("segmentId", value)} />}
        </Field>
        <Field id="radius-resultUf" label="UF dos resultados" optional hint="Filtra o que volta. Não muda a origem." changed={changed("resultUf")}>
          {(a11y) => <UfSelect id={a11y.id} value={values.resultUf} describedBy={a11y.describedBy} onChange={(value) => onChange("resultUf", value)} />}
        </Field>
      </div>
    </>
  );
}

function NeighborsMain({ values, errors, changed, catalog, onChange }: {
  values: NeighborsFormValues;
  errors: NeighborsValidationErrors;
  changed: ChangedLookup;
  catalog: SegmentCatalog;
  onChange: DiscoveryCriteriaProps["onNeighborsChange"];
}) {
  return (
    <div className="criteria-grid criteria-grid--4">
      <Field id="neighbors-cnpj" label="CNPJ de referência" hint="Aceita letras e números. A própria origem é excluída." error={errors.cnpj} changed={changed("cnpj")}>
        {(a11y) => <TextInput a11y={a11y} value={values.cnpj} onChange={(value) => onChange("cnpj", value)} />}
      </Field>
      <Field id="neighbors-radiusKm" label="Raio (km)" error={errors.radiusKm} changed={changed("radiusKm")}>
        {(a11y) => <TextInput a11y={a11y} value={values.radiusKm} onChange={(value) => onChange("radiusKm", value)} />}
      </Field>
      <Field id="neighbors-segment" label="Segmento" optional changed={changed("segmentId")}>
        {(a11y) => <SegmentSelect catalog={catalog} id={a11y.id} value={values.segmentId} describedBy={a11y.describedBy} onChange={(value) => onChange("segmentId", value)} />}
      </Field>
      <Field id="neighbors-resultUf" label="UF dos resultados" optional hint="Filtra o que volta." changed={changed("resultUf")}>
        {(a11y) => <UfSelect id={a11y.id} value={values.resultUf} describedBy={a11y.describedBy} onChange={(value) => onChange("resultUf", value)} />}
      </Field>
    </div>
  );
}

function RootMain({ values, errors, changed, onChange }: {
  values: RootBranchesFormValues;
  errors: RootBranchesValidationErrors;
  changed: ChangedLookup;
  onChange: DiscoveryCriteriaProps["onRootChange"];
}) {
  const cnpj = values.identifierKind === "cnpj";
  return (
    <>
      <ChoiceGroup
        label="Identificar por"
        name="root-identifier-kind"
        value={values.identifierKind}
        options={[["cnpj", "CNPJ completo"], ["root", "Raiz do CNPJ"]]}
        variant="chips"
        onChange={(value) => onChange("identifierKind", value)}
      />
      {changed("identifierKind") !== undefined && (
        <p className="changed-hint">Identificação alterada · pesquisado: {changed("identifierKind")}</p>
      )}
      <div className="criteria-grid criteria-grid--2">
        <Field
          id="root-identifier-value"
          label={cnpj ? "CNPJ completo" : "Raiz do CNPJ"}
          hint={cnpj ? "Vira a referência destacada nos resultados. Aceita letras e números." : "Oito caracteres iniciais do CNPJ. Aceita letras e números."}
          error={errors.identifierValue}
          changed={changed("identifierValue")}
        >
          {(a11y) => <TextInput a11y={a11y} value={values.identifierValue} onChange={(value) => onChange("identifierValue", value)} />}
        </Field>
      </div>
    </>
  );
}

function GroupMain({ values, errors, changed, onChange }: {
  values: CommercialGroupFormValues;
  errors: CommercialGroupValidationErrors;
  changed: ChangedLookup;
  onChange: DiscoveryCriteriaProps["onGroupChange"];
}) {
  return (
    <div className="criteria-grid criteria-grid--2">
      <Field id="commercial-group-id" label="ID do grupo registrado" hint="Só grupos registrados no Sentinel. Não busca por nome nem por sócios." error={errors.groupId} changed={changed("groupId")}>
        {(a11y) => <TextInput a11y={a11y} value={values.groupId} onChange={(value) => onChange("groupId", value)} />}
      </Field>
    </div>
  );
}

export function DiscoveryCriteria(props: DiscoveryCriteriaProps) {
  const { draft, errors, changes, searching, catalog, notice } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  const changedMap = new Map((changes ?? []).map((change) => [change.key, change.submitted]));
  const changed: ChangedLookup = (key) => changedMap.get(key);

  const complementary = draft.family === "filters"
    ? (["codigoTom", "codigoIbge", "porteCodigo", "capitalMin", "capitalMax"] as const)
      .filter((field) => draft.filters[field].trim() !== "").length
    : 0;
  const activeMore = complementary + (draft.includeDiscarded ? 1 : 0);
  const pending = changes?.length ?? 0;
  // Erros de filtros complementares nunca ficam escondidos no bloco recolhido.
  const moreErrors = draft.family === "filters" && Boolean(errors.filtered?.capitalMin || errors.filtered?.capitalMax);
  const moreVisible = moreOpen || moreErrors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <form className="criteria-card" aria-label="Critérios da busca" onSubmit={submit} noValidate>
      <FamilySwitcher family={draft.family} onChange={props.onFamilyChange} />
      <div className="criteria-body">
        {notice && <p className="loaded-notice" role="status">{notice}</p>}
        {draft.family === "filters" && (
          <FiltersMain values={draft.filters} errors={errors.filtered ?? {}} changed={changed} catalog={catalog} onChange={props.onFiltersChange} />
        )}
        {draft.family === "proximity" && (
          <>
            <ChoiceGroup
              label="Tipo"
              name="proximity-type"
              value={draft.proximityType}
              options={[["radius", "Raio a partir de uma origem"], ["neighbors", "Vizinhos de um CNPJ"]]}
              variant="segmented"
              hint="Raio por CNPJ pode incluir a própria origem. Vizinhos sempre a exclui."
              onChange={props.onProximityTypeChange}
            />
            {draft.proximityType === "radius"
              ? <RadiusMain values={draft.radius} errors={errors.radius ?? {}} changed={changed} catalog={catalog} onChange={props.onRadiusChange} />
              : <NeighborsMain values={draft.neighbors} errors={errors.neighbors ?? {}} changed={changed} catalog={catalog} onChange={props.onNeighborsChange} />}
          </>
        )}
        {draft.family === "structure" && (
          <>
            <ChoiceGroup
              label="Tipo"
              name="structure-type"
              value={draft.structureType}
              options={[["root", "Raiz e filiais"], ["group", "Grupo comercial registrado"]]}
              variant="segmented"
              onChange={props.onStructureTypeChange}
            />
            {draft.structureType === "root"
              ? <RootMain values={draft.root} errors={errors.root ?? {}} changed={changed} onChange={props.onRootChange} />
              : <GroupMain values={draft.group} errors={errors.group ?? {}} changed={changed} onChange={props.onGroupChange} />}
          </>
        )}
        <div id="more-filters" className="more-filters" role="region" aria-label="Mais filtros" hidden={!moreVisible}>
          {draft.family === "filters" && (
            <FiltersMore values={draft.filters} errors={errors.filtered ?? {}} changed={changed} onChange={props.onFiltersChange} />
          )}
          <div className={`discarded-visibility-control${changed("includeDiscarded") !== undefined ? " field-group--changed" : ""}`}>
            <label htmlFor="include-discarded">
              <input
                id="include-discarded"
                type="checkbox"
                checked={draft.includeDiscarded}
                aria-describedby={changed("includeDiscarded") !== undefined ? "include-discarded-help include-discarded-changed" : "include-discarded-help"}
                onChange={(event) => props.onIncludeDiscardedChange(event.target.checked)}
              />
              <span>Mostrar descartados</span>
            </label>
            {changed("includeDiscarded") !== undefined && <span className="changed-badge">alterado</span>}
            <p id="include-discarded-help">Inclui empresas que você marcou como descartadas.</p>
            {changed("includeDiscarded") !== undefined && (
              <p id="include-discarded-changed" className="changed-hint">Pesquisado: descartados {changed("includeDiscarded")}</p>
            )}
          </div>
        </div>
      </div>
      <div className="criteria-footer">
        <button
          type="button"
          className="more-toggle"
          aria-expanded={moreVisible}
          aria-controls="more-filters"
          onClick={() => setMoreOpen(!moreVisible)}
        >
          <SlidersHorizontal aria-hidden="true" size={15} />
          <span>Mais filtros</span>
          {activeMore > 0 && (
            <span className="more-toggle__badge">
              {activeMore} {activeMore === 1 ? "ativo" : "ativos"}
            </span>
          )}
          {moreVisible ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}
        </button>
        <div className="criteria-footer__end">
          {pending > 0 && (
            <>
              <span className="pending-summary">
                {pending} {pending === 1 ? "alteração não pesquisada" : "alterações não pesquisadas"}
              </span>
              <button type="button" className="link-button" onClick={props.onUndo}>
                <Undo2 aria-hidden="true" size={15} /> Desfazer
              </button>
            </>
          )}
          <button className="primary-button" type="submit" disabled={searching} aria-busy={searching || undefined}>
            <Search aria-hidden="true" size={16} />
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>
    </form>
  );
}
