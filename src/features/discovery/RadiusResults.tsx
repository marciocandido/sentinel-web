import type { DiscoveryEstablishment } from "../../types/api";
import { DiscoveryPagination } from "./DiscoveryPagination";
import { RadiusMap } from "./RadiusMap";
import { RadiusTable } from "./RadiusTable";
import type { RadiusViewState } from "./radiusTypes";
import { publicRadiusError } from "./radiusUtils";

const show = (value: string | null) => value || "—";

interface RadiusResultsProps {
  state: RadiusViewState;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
  onSelect: (item: DiscoveryEstablishment) => void;
}

export function RadiusResults({
  state,
  onRetry,
  onPrevious,
  onNext,
  onLimitChange,
  onSelect,
}: RadiusResultsProps) {
  return (
    <section
      className="results-section"
      aria-labelledby="radius-results-title"
      aria-busy={state.kind === "loading"}
      aria-live="polite"
    >
      <h2 id="radius-results-title">Resultados por raio</h2>
      {state.kind === "initial" && (
        <p className="empty-state">Informe a origem e execute uma busca.</p>
      )}
      {state.kind === "loading" && (
        <p className="loading-state" role="status">
          <span className="mini-spinner" aria-hidden="true" />
          Buscando estabelecimentos...
        </p>
      )}
      {state.kind === "error" && (
        <div className="results-error" role="alert">
          <p>{publicRadiusError(state.code)}</p>
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
          <div className="radius-origin" aria-label="Origem resolvida">
            <h3>Origem resolvida</h3>
            <p>
              <strong>Tipo:</strong> {state.page.origin.kind} ·{" "}
              <strong>Município/UF:</strong>{" "}
              {show(state.page.origin.municipio_nome)} /{" "}
              {show(state.page.origin.uf)} · <strong>CNPJ:</strong>{" "}
              {show(state.page.origin.cnpj_full)}
            </p>
            <p>
              <strong>TOM:</strong> {show(state.page.origin.codigo_tom)} ·{" "}
              <strong>IBGE:</strong> {show(state.page.origin.codigo_ibge)} ·{" "}
              <strong>Latitude:</strong> {state.page.origin.latitude} ·{" "}
              <strong>Longitude:</strong> {state.page.origin.longitude} ·{" "}
              <strong>Precisão:</strong> {state.page.origin.location_precision} ·{" "}
              <strong>Raio:</strong> {state.snapshot.radiusKm} km
            </p>
            <p className="centroid-note">
              As posições com precisão MUNICIPIO representam centroides
              municipais.
            </p>
          </div>
          {state.page.items.length === 0 && (
            <p className="empty-state" role="status">
              Nenhum estabelecimento foi encontrado.
            </p>
          )}
          <div className="radius-results-layout">
            <RadiusMap
              data={{
                origin: state.page.origin,
                radiusKm: state.snapshot.radiusKm,
                items: state.page.items,
              }}
            />
            <div className="radius-table-panel">
              <RadiusTable items={state.page.items} onSelect={onSelect} />
            </div>
          </div>
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
