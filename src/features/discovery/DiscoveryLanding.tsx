import { SegmentSelect } from "../../components/SegmentSelect";

export function DiscoveryLanding() {
  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div className="page-intro">
        <p className="eyebrow">Discovery</p>
        <h1 id="discovery-title">Buscar empresas</h1>
        <p>Comece pelo segmento. Os filtros regionais e a execução da pesquisa entram na próxima etapa.</p>
      </div>

      <article className="search-card" aria-labelledby="search-card-title">
        <div>
          <h2 id="search-card-title">Critérios iniciais</h2>
          <p className="muted">O catálogo é carregado diretamente da API do Sentinel.</p>
        </div>
        <div className="field-group">
          <label htmlFor="segment">Segmento</label>
          <SegmentSelect />
        </div>
        <div className="regional-placeholder" aria-label="Filtros regionais em breve">
          <span className="regional-placeholder__icon" aria-hidden="true">⌖</span>
          <div>
            <strong>Filtros regionais</strong>
            <p>UF e município estarão disponíveis na próxima etapa.</p>
          </div>
        </div>
        <div className="search-actions">
          <button className="primary-button" type="button" disabled>Buscar</button>
          <p>A execução da busca será habilitada na próxima etapa.</p>
        </div>
      </article>
    </section>
  );
}
