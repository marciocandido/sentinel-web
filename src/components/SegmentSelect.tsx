import type { SegmentCatalog } from "./segmentCatalog";

function publicErrorMessage(code: string): string {
  if (code === "database_unavailable") {
    return "O catálogo não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível carregar os segmentos. Verifique a conexão com a API e tente novamente.";
}

interface SegmentSelectProps {
  catalog: SegmentCatalog;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  emptyLabel?: string;
}

export function SegmentSelect({
  catalog,
  id = "segment",
  value,
  onChange,
  invalid,
  describedBy,
  emptyLabel = "Selecione um segmento",
}: SegmentSelectProps) {
  const { state, retry } = catalog;

  if (state.kind === "loading") {
    return <p className="field-message" role="status"><span className="mini-spinner" aria-hidden="true" />Carregando segmentos...</p>;
  }

  if (state.kind === "error") {
    return (
      <div className="field-error" role="alert">
        <p>{publicErrorMessage(state.code)}</p>
        <button className="secondary-button" type="button" onClick={retry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <>
        <select id={id} name="segment" disabled value="" aria-describedby={`${id}-empty-message`}>
          <option>{emptyLabel}</option>
        </select>
        <p id={`${id}-empty-message`} className="field-message">Nenhum segmento disponível.</p>
      </>
    );
  }

  const known = state.items.some((segment) => segment.id === value);
  return (
    <select
      id={id}
      name="segment"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <option value="">{emptyLabel}</option>
      {value !== "" && !known && <option value={value}>{value}</option>}
      {state.items.map((segment) => (
        <option key={segment.id} value={segment.id}>{segment.name}</option>
      ))}
    </select>
  );
}
