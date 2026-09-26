import { AlertTriangle, Bookmark, Clock, Info, ListChecks, RotateCw, Search, Undo2 } from "lucide-react";
import type { RefObject } from "react";
import type { DiscoveryExportFormat, DiscoverySearchSpec } from "../../services/sentinelApi";
import type { DiscoveryEstablishment } from "../../types/api";
import { publicCommercialGroupError } from "./commercialGroupUtils";
import {
  describeSearch,
  formatSubmittedAt,
  QUERY_KIND_LABELS,
  type DraftChange,
  type SegmentNameLookup,
} from "./discoveryQuery";
import type { DiscoverySubmission, QueryKind, ResultsState } from "./discoveryTypes";
import { publicSearchError, TIMEOUT_MESSAGE } from "./discoveryUtils";
import { publicNeighborsError } from "./neighborsUtils";
import { QueryActions } from "./QueryActions";
import { QueryResultView } from "./QueryResultView";
import { publicRadiusError } from "./radiusUtils";
import { ResultsErrorBoundary } from "./ResultsErrorBoundary";
import { publicRootBranchesError } from "./rootBranchesUtils";
import type { DiscoveryExportState } from "./useDiscoveryExport";

interface DiscoveryResultsAreaProps {
  submission: DiscoverySubmission | null;
  results: ResultsState;
  /** A consulta submetida já teve ao menos uma página bem-sucedida. */
  actionsAvailable: boolean;
  /** Diferenças do rascunho em relação à consulta; `null` quando o rascunho é de outro tipo. */
  changes: DraftChange[] | null;
  /** O rascunho visível pertence a outra família/tipo de consulta. */
  otherKindVisible: boolean;
  narrow: boolean;
  segmentName: SegmentNameLookup;
  focusRef: RefObject<HTMLHeadingElement | null>;
  exportState: DiscoveryExportState;
  onExport: (format: DiscoveryExportFormat, search: DiscoverySearchSpec) => void;
  onUndo: () => void;
  onSearchWithChanges: () => void;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
  onSelect: (item: DiscoveryEstablishment) => void;
  onOpenSavedSearches: () => void;
  onOpenWorklists: () => void;
}

function queryError(kind: QueryKind, code: string): string {
  if (code === "request_timeout") return TIMEOUT_MESSAGE;
  if (kind === "radius") return publicRadiusError(code);
  if (kind === "neighbors") return publicNeighborsError(code);
  if (kind === "root") return publicRootBranchesError(code);
  if (kind === "group") return publicCommercialGroupError(code);
  return publicSearchError(code);
}

function StaleNotice({ changes, onUndo, onSearchWithChanges }: { changes: DraftChange[]; onUndo: () => void; onSearchWithChanges: () => void }) {
  const single = changes.length === 1 ? changes[0] : null;
  return (
    <div className="stale-notice" role="status">
      <AlertTriangle aria-hidden="true" size={18} />
      <div className="stale-notice__text">
        <p>
          <strong>Formulário alterado.</strong>{" "}
          {single
            ? <>{single.label}: {single.submitted} → {single.current}. Os resultados abaixo continuam sendo de {single.label} {single.submitted}.</>
            : <>{changes.length} campos mudaram ({changes.map((change) => change.label).join(", ")}). Os resultados abaixo continuam sendo da consulta submetida.</>}
        </p>
        <p>Exportar, salvar pesquisa e criar lista também usam a consulta submetida.</p>
      </div>
      <div className="stale-notice__actions">
        <button className="secondary-button" type="button" onClick={onUndo}>
          <Undo2 aria-hidden="true" size={15} /> Desfazer alterações
        </button>
        <button className="primary-button primary-button--compact" type="button" onClick={onSearchWithChanges}>
          <Search aria-hidden="true" size={15} /> Buscar com alterações
        </button>
      </div>
    </div>
  );
}

function EmptySession({ onOpenSavedSearches, onOpenWorklists }: Pick<DiscoveryResultsAreaProps, "onOpenSavedSearches" | "onOpenWorklists">) {
  return (
    <div className="empty-session">
      <p className="empty-session__lead">Escolha o tipo de busca, preencha os critérios e clique em Buscar.</p>
      <ul className="empty-session__cards">
        <li><strong>Filtros</strong><span>Quem atua neste segmento, região, porte ou faixa de capital?</span></li>
        <li><strong>Proximidade</strong><span>Quem está perto deste cliente ou município? Origem por município, CNPJ, TOM, IBGE ou coordenadas.</span></li>
        <li><strong>Estrutura</strong><span>Que outros estabelecimentos esta empresa ou grupo registrado tem na base?</span></li>
      </ul>
      <div className="info-note" role="note">
        <Info aria-hidden="true" size={16} />
        <p>
          <strong>Sobre a base.</strong> Recorte útil da Receita Federal. Localização pelo centroide do município.
          Status comercial é sempre desconhecido: não há integração com ERP.
        </p>
      </div>
      <div className="empty-session__actions">
        <button className="secondary-button" type="button" onClick={onOpenSavedSearches}>
          <Bookmark aria-hidden="true" size={15} /> Abrir pesquisas salvas
        </button>
        <button className="secondary-button" type="button" onClick={onOpenWorklists}>
          <ListChecks aria-hidden="true" size={15} /> Ver listas de trabalho
        </button>
      </div>
    </div>
  );
}

export function DiscoveryResultsArea({
  submission,
  results,
  actionsAvailable,
  changes,
  otherKindVisible,
  narrow,
  segmentName,
  focusRef,
  exportState,
  onExport,
  onUndo,
  onSearchWithChanges,
  onRetry,
  onPrevious,
  onNext,
  onLimitChange,
  onSelect,
  onOpenSavedSearches,
  onOpenWorklists,
}: DiscoveryResultsAreaProps) {
  const criteria = submission ? describeSearch(submission.spec, segmentName) : [];
  const includeDiscarded = submission?.query.snapshot.includeDiscarded ?? false;
  const changeFor = (key: string) =>
    changes?.find((change) => change.key === key ||
      (key === "origin" && change.key.startsWith("origin")) ||
      (key === "identifierValue" && change.key === "identifierKind"));

  return (
    <section className="results-section" aria-labelledby="results-title" aria-busy={results.kind === "loading"}>
      <header className="results-header">
        <div className="receipt">
          <div className="receipt__title">
            <h2 id="results-title" ref={focusRef} tabIndex={-1}>Resultados</h2>
            {submission && <span className="kind-badge">{QUERY_KIND_LABELS[submission.query.kind]}</span>}
          </div>
          {submission ? (
            <>
              <p className="receipt__meta">
                Consulta submetida às {formatSubmittedAt(submission.submittedAt)} ·{" "}
                {includeDiscarded ? "descartados incluídos" : "descartados ocultos"}
                {changeFor("includeDiscarded") && <span className="changed-badge">não pesquisado</span>}
              </p>
              <ul className="criteria-chips" aria-label="Critérios da consulta submetida">
                {criteria.map((item) => {
                  const change = changeFor(item.key);
                  return (
                    <li key={item.key} className={`criteria-chip${change ? " criteria-chip--changed" : ""}`}>
                      <span className="criteria-chip__label">{item.label}:</span>{" "}
                      {item.value}
                      {change && (
                        <>
                          {change.key === item.key && <> → {change.current}</>}{" "}
                          <span className="changed-badge">não pesquisado</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="receipt__meta">Nenhuma consulta nesta sessão.</p>
          )}
        </div>
        {submission && actionsAvailable && (
          <QueryActions
            key={submission.id}
            search={submission.spec}
            exportState={exportState}
            onExport={onExport}
          />
        )}
      </header>

      {submission && otherKindVisible && (
        <p className="results-kind-note">
          Estes resultados são de {QUERY_KIND_LABELS[submission.query.kind]}. Trocar o tipo de busca não faz uma nova busca.
        </p>
      )}
      {changes && changes.length > 0 && (
        <StaleNotice changes={changes} onUndo={onUndo} onSearchWithChanges={onSearchWithChanges} />
      )}

      <div className="results-body" aria-live="polite">
        {!submission && results.kind === "initial" && (
          <EmptySession onOpenSavedSearches={onOpenSavedSearches} onOpenWorklists={onOpenWorklists} />
        )}
        {results.kind === "loading" && (
          <p className="loading-state" role="status"><span className="mini-spinner" aria-hidden="true" />Buscando empresas...</p>
        )}
        {results.kind === "cancelled" && (
          <div className="results-notice" role="status">
            <p>Busca cancelada ao trocar o tipo de busca. A consulta submetida foi preservada: tentar de novo repete exatamente essa consulta.</p>
            <button type="button" className="secondary-button" onClick={onRetry}>
              <RotateCw aria-hidden="true" size={15} /> Tentar novamente
            </button>
          </div>
        )}
        {results.kind === "error" && submission && (
          <div className="results-error" role="alert">
            {results.code === "request_timeout" && <Clock aria-hidden="true" size={16} />}
            <p>{queryError(submission.query.kind, results.code)}</p>
            <button type="button" className="secondary-button" onClick={onRetry}>
              <RotateCw aria-hidden="true" size={15} /> Tentar novamente
            </button>
          </div>
        )}
        {results.kind === "success" && (
          <ResultsErrorBoundary
            resetKey={results}
            fallback={(reset) => (
              <div className="results-error" role="alert">
                <p>Não foi possível exibir os resultados desta busca. Os filtros foram preservados.</p>
                <button type="button" className="secondary-button" onClick={() => { reset(); onRetry(); }}>
                  Tentar novamente
                </button>
              </div>
            )}
          >
            <QueryResultView
              result={results.result}
              narrow={narrow}
              onSelect={onSelect}
              onPrevious={onPrevious}
              onNext={onNext}
              onLimitChange={onLimitChange}
            />
          </ResultsErrorBoundary>
        )}
      </div>
    </section>
  );
}
