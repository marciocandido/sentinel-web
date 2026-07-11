import type { DiscoveryViewState } from "./discoveryTypes";
import { publicSearchError } from "./discoveryUtils";
import { DiscoveryPagination } from "./DiscoveryPagination";
import { DiscoveryTable } from "./DiscoveryTable";
import type { DiscoveryEstablishment } from "../../types/api";

interface DiscoveryResultsProps {
  state: DiscoveryViewState;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
  onSelectEstablishment: (establishment: DiscoveryEstablishment) => void;
}

export function DiscoveryResults({
  state,
  onRetry,
  onPrevious,
  onNext,
  onLimitChange,
  onSelectEstablishment,
}: DiscoveryResultsProps) {
  return (
    <section
      className="results-section"
      aria-labelledby="results-title"
      aria-busy={state.kind === "loading"}
      aria-live="polite"
    >
      <h2 id="results-title">Resultados</h2>
      {state.kind === "initial" && <p className="empty-state">Preencha os filtros e execute uma busca.</p>}
      {state.kind === "loading" && (
        <p className="loading-state" role="status"><span className="mini-spinner" aria-hidden="true" />Buscando empresas...</p>
      )}
      {state.kind === "error" && (
        <div className="results-error" role="status">
          <p>{publicSearchError(state.code)}</p>
          <button type="button" className="secondary-button" onClick={onRetry}>Tentar novamente</button>
        </div>
      )}
      {state.kind === "success" && state.page.items.length === 0 && (
        <p className="empty-state" role="status">Nenhuma empresa encontrada para os critérios submetidos.</p>
      )}
      {state.kind === "success" && (
        <>
          {state.page.items.length > 0 && (
            <DiscoveryTable items={state.page.items} onSelectEstablishment={onSelectEstablishment} />
          )}
          <DiscoveryPagination
            pagination={state.page.pagination}
            disabled={false}
            onPrevious={onPrevious}
            onNext={onNext}
            onLimitChange={onLimitChange}
          />
        </>
      )}
    </section>
  );
}
