import type { RefObject } from "react";
import type { CommercialGroupKnownEstablishment } from "../../types/api";
import { CommercialGroupTable } from "./CommercialGroupTable";
import { DiscoveryPagination } from "./DiscoveryPagination";
import type { CommercialGroupViewState } from "./commercialGroupTypes";
import {
  commercialGroupValue,
  publicCommercialGroupError,
} from "./commercialGroupUtils";

interface CommercialGroupResultsProps {
  state: CommercialGroupViewState;
  focusRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
  onSelect: (item: CommercialGroupKnownEstablishment) => void;
}

export function CommercialGroupResults({
  state,
  focusRef,
  onRetry,
  onPrevious,
  onNext,
  onLimitChange,
  onSelect,
}: CommercialGroupResultsProps) {
  return (
    <section
      className="results-section"
      aria-labelledby="commercial-group-results-title"
      aria-busy={state.kind === "loading"}
      aria-live="polite"
    >
      <h2 id="commercial-group-results-title" ref={focusRef} tabIndex={-1}>
        Resultados por grupo comercial
      </h2>
      {state.kind === "initial" && (
        <p className="empty-state">
          Informe o ID de um grupo previamente registrado e execute a busca.
        </p>
      )}
      {state.kind === "loading" && (
        <p className="loading-state" role="status">
          <span className="mini-spinner" aria-hidden="true" />
          Buscando raízes registradas...
        </p>
      )}
      {state.kind === "error" && (
        <div className="results-error" role="alert">
          <p>{publicCommercialGroupError(state.code)}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={onRetry}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {state.kind === "success" && (
        <>
          <div
            className="commercial-group-context"
            aria-label="Contexto do grupo comercial"
          >
            <h3>Grupo comercial registrado</h3>
            <dl>
              <div>
                <dt>ID do grupo</dt>
                <dd className="cell-code">{state.page.group.group_id}</dd>
              </div>
              <div>
                <dt>Nome do grupo</dt>
                <dd>{commercialGroupValue(state.page.group.name)}</dd>
              </div>
              <div>
                <dt>Escopo de associação</dt>
                <dd>{state.page.group.membership_scope}</dd>
              </div>
              <div>
                <dt>Escopo dos estabelecimentos</dt>
                <dd>{state.page.group.establishment_data_scope}</dd>
              </div>
            </dl>
          </div>
          <div className="coverage-note" role="note">
            Esta consulta mostra somente raízes explicitamente registradas no
            grupo. Os dados de estabelecimentos vêm da base útil do Sentinel e
            podem estar ausentes. O resultado não representa uma estrutura
            societária completa nem confirma relações empresariais.
          </div>
          {state.page.items.length === 0 ? (
            <p className="empty-state" role="status">
              Nenhum item registrado foi encontrado nesta página.
            </p>
          ) : (
            <CommercialGroupTable
              items={state.page.items}
              onSelect={onSelect}
            />
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
