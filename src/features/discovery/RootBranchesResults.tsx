import type { RefObject } from "react";
import type { RootBranchEstablishment } from "../../types/api";
import { DiscoveryPagination } from "./DiscoveryPagination";
import { RootBranchesTable } from "./RootBranchesTable";
import type { RootBranchesViewState } from "./rootBranchesTypes";
import {
  publicRootBranchesError,
  rootBranchValue,
} from "./rootBranchesUtils";

interface RootBranchesResultsProps {
  state: RootBranchesViewState;
  focusRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
  onSelect: (item: RootBranchEstablishment) => void;
}

export function RootBranchesResults({
  state,
  focusRef,
  onRetry,
  onPrevious,
  onNext,
  onLimitChange,
  onSelect,
}: RootBranchesResultsProps) {
  return (
    <section
      className="results-section"
      aria-labelledby="root-branches-results-title"
      aria-busy={state.kind === "loading"}
      aria-live="polite"
    >
      <h2 id="root-branches-results-title" ref={focusRef} tabIndex={-1}>
        Resultados por raiz e filiais
      </h2>
      {state.kind === "initial" && (
        <p className="empty-state">
          Informe um CNPJ completo ou uma raiz e execute a busca.
        </p>
      )}
      {state.kind === "loading" && (
        <p className="loading-state" role="status">
          <span className="mini-spinner" aria-hidden="true" />
          Buscando estabelecimentos conhecidos...
        </p>
      )}
      {state.kind === "error" && (
        <div className="results-error" role="alert">
          <p>{publicRootBranchesError(state.code)}</p>
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
          <div className="root-context" aria-label="Contexto da raiz">
            <h3>Raiz resolvida</h3>
            <dl>
              <div>
                <dt>Raiz resolvida</dt>
                <dd className="cell-code">{state.page.root.cnpj_root}</dd>
              </div>
              <div>
                <dt>CNPJ de referência</dt>
                <dd className="cell-code">
                  {rootBranchValue(state.page.root.reference_cnpj_full)}
                </dd>
              </div>
              <div>
                <dt>Escopo dos dados</dt>
                <dd>{state.page.root.data_scope}</dd>
              </div>
            </dl>
          </div>
          <div className="coverage-note" role="note">
            <strong>Escopo dos dados: BASE_UTIL.</strong>{" "}
            Esta consulta considera somente os estabelecimentos conhecidos na
            base útil do Sentinel. Podem estar ausentes estabelecimentos
            inativos, unidades fora dos segmentos úteis e filiais não presentes
            no recorte carregado.
          </div>
          {state.page.items.length === 0 ? (
            <p className="empty-state" role="status">
              Nenhum estabelecimento conhecido foi encontrado nesta página.
            </p>
          ) : (
            <RootBranchesTable items={state.page.items} onSelect={onSelect} />
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
