import { DiscoveryPagination } from "./DiscoveryPagination";
import { RadiusMap } from "./RadiusMap";
import { NeighborsTable } from "./NeighborsTable";
import type { NeighborsViewState } from "./neighborsTypes";
import { publicNeighborsError } from "./neighborsUtils";
import { feedbackReferenceOrNull } from "./feedbackUtils";

const show = (value: string | null) => value || "—";
interface Props { state: NeighborsViewState; onRetry: () => void; onPrevious: () => void; onNext: () => void; onLimitChange: (limit: number) => void; }
export function NeighborsResults({ state, onRetry, onPrevious, onNext, onLimitChange }: Props) {
  return <section className="results-section" aria-labelledby="neighbors-results-title" aria-busy={state.kind === "loading"} aria-live="polite"><h2 id="neighbors-results-title">Estabelecimentos vizinhos</h2>
    {state.kind === "initial" && <p className="empty-state">Informe um CNPJ de referência e execute a busca.</p>}
    {state.kind === "loading" && <p className="loading-state" role="status"><span className="mini-spinner" aria-hidden="true" />Buscando estabelecimentos...</p>}
    {state.kind === "error" && <div className="results-error" role="alert"><p>{publicNeighborsError(state.code)}</p><button type="button" className="secondary-button" onClick={onRetry}>Tentar novamente</button></div>}
    {state.kind === "success" && <><div className="radius-origin" aria-label="Origem resolvida"><h3>Origem resolvida</h3><p><strong>CNPJ:</strong> {show(state.page.origin.cnpj_full)} · <strong>Município/UF:</strong> {show(state.page.origin.municipio_nome)} / {show(state.page.origin.uf)}</p><p><strong>TOM:</strong> {show(state.page.origin.codigo_tom)} · <strong>IBGE:</strong> {show(state.page.origin.codigo_ibge)} · <strong>Latitude:</strong> {state.page.origin.latitude} · <strong>Longitude:</strong> {state.page.origin.longitude} · <strong>Precisão:</strong> {state.page.origin.location_precision} · <strong>Raio:</strong> {state.snapshot.radiusKm} km</p><p className="centroid-note">As posições com precisão MUNICIPIO representam centroides municipais.</p></div>
      {state.page.items.length === 0 && <p className="empty-state" role="status">Nenhum estabelecimento vizinho foi encontrado.</p>}
      <div className="radius-results-layout"><RadiusMap data={{ origin: state.page.origin, radiusKm: state.snapshot.radiusKm, items: state.page.items }} accessibleName="Mapa dos estabelecimentos vizinhos" /><div className="radius-table-panel"><NeighborsTable items={state.page.items} feedbackSource={{ kind: "NEIGHBORS", reference: feedbackReferenceOrNull(state.snapshot.cnpj) }} /></div></div>
      <DiscoveryPagination pagination={state.page.pagination} disabled={false} onPrevious={onPrevious} onNext={onNext} onLimitChange={onLimitChange} /></>}
  </section>;
}
