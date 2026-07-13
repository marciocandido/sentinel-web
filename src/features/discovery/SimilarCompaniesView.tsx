import type { SimilarCompanyPage } from "../../types/api";
import { publicSimilarError, similarityReasonLabel, similarValue } from "./similarityUtils";

export type SimilarCompaniesState =
  | { kind: "idle" }
  | { kind: "loading"; offset: number }
  | { kind: "success"; page: SimilarCompanyPage }
  | { kind: "error"; code: string; offset: number };

interface SimilarCompaniesViewProps {
  state: SimilarCompaniesState;
  onBack: () => void;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const distanceFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function SimilarCompaniesView({
  state,
  onBack,
  onRetry,
  onPrevious,
  onNext,
}: SimilarCompaniesViewProps) {
  const loading = state.kind === "loading";
  const page = state.kind === "success" ? state.page : null;

  return (
    <div className="similar-view">
      <button className="secondary-button similar-back" type="button" onClick={onBack}>
        Voltar aos detalhes
      </button>

      <section
        className="similar-results"
        role="region"
        aria-label="Resultados de empresas semelhantes"
        aria-busy={loading}
      >
        {loading && (
          <p className="loading-state">
            <span className="mini-spinner" aria-hidden="true" />
            Consultando empresas semelhantes...
          </p>
        )}

        {state.kind === "error" && (
          <div className="results-error" role="alert">
            <p>{publicSimilarError(state.code)}</p>
            <button className="secondary-button" type="button" onClick={onRetry}>
              Tentar novamente
            </button>
          </div>
        )}

        {page && page.items.length === 0 && (
          <p className="empty-state">Nenhuma empresa semelhante foi encontrada.</p>
        )}

        {page && page.items.length > 0 && (
          <ol className="similar-list">
            {page.items.map((company) => (
              <li className="similar-card" key={company.cnpj_full}>
                <div className="similar-card__heading">
                  <div>
                    <h3>{similarValue(company.razao_social)}</h3>
                    {company.nome_fantasia && <p>{company.nome_fantasia}</p>}
                  </div>
                  <span className="similar-rank">Rank {company.similarity_rank}</span>
                </div>

                <dl className="similar-fields">
                  <div><dt>CNPJ completo</dt><dd className="cell-code">{company.cnpj_full}</dd></div>
                  <div><dt>CNPJ raiz</dt><dd className="cell-code">{company.cnpj_root}</dd></div>
                  <div><dt>Município / UF</dt><dd>{similarValue(company.municipio_nome)} / {similarValue(company.uf)}</dd></div>
                  <div><dt>Código TOM</dt><dd className="cell-code">{similarValue(company.codigo_tom)}</dd></div>
                  <div><dt>Código IBGE</dt><dd className="cell-code">{similarValue(company.codigo_ibge)}</dd></div>
                  <div><dt>CNAE principal</dt><dd className="cell-code">{similarValue(company.cnae_principal)}</dd></div>
                  <div><dt>Porte</dt><dd className="cell-code">{similarValue(company.porte_codigo)}</dd></div>
                  <div><dt>Capital social</dt><dd className="cell-code">{similarValue(company.capital_social)}</dd></div>
                  <div><dt>Precisão geográfica</dt><dd>{similarValue(company.location_precision)}</dd></div>
                  {company.distance_km !== null && (
                    <div><dt>Distância</dt><dd>{distanceFormatter.format(company.distance_km)} km</dd></div>
                  )}
                  <div className="similar-fields__wide">
                    <dt>Status comercial</dt>
                    <dd><span className="status-unknown">Desconhecido (provisório)</span></dd>
                  </div>
                </dl>

                <div className="similar-reasons">
                  <h4>Razões de similaridade</h4>
                  <ul>
                    {company.similarity_reasons.map((reason, index) => (
                      <li key={`${reason}-${index}`}>{similarityReasonLabel(reason)}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        )}

        {page && (
          <nav className="similar-pagination" aria-label="Paginação de empresas semelhantes">
            <p>Página {Math.floor(page.pagination.offset / page.pagination.limit) + 1}</p>
            <div>
              <button
                className="secondary-button"
                type="button"
                disabled={page.pagination.offset === 0 || loading}
                onClick={onPrevious}
              >
                Anterior
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!page.pagination.has_more || loading}
                onClick={onNext}
              >
                Próxima
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
