import { MapPin, Network } from "lucide-react";
import type {
  CommercialGroupItem,
  CommercialGroupKnownEstablishment,
  DiscoveryEstablishment,
  FeedbackSource,
  NeighborEstablishment,
  PaginationMeta,
  RadiusSearchEstablishment,
  RadiusSearchOrigin,
  RootBranchEstablishment,
} from "../../types/api";
import { DiscoveryPagination } from "./DiscoveryPagination";
import {
  companySubtitle,
  companyTitle,
  displayText,
  formatCapital,
  formatDistance,
  formatRadius,
  locationText,
  matchBadge,
} from "./discoveryQuery";
import type { QueryResult } from "./discoveryTypes";
import { feedbackReferenceOrNull } from "./feedbackUtils";
import { RadiusMap } from "./RadiusMap";
import { CommercialStatus, MatchTag, ResultsCollection, type ResultColumn } from "./ResultsCollection";
import { rootBranchRoleLabel } from "./rootBranchesUtils";

interface QueryResultViewProps {
  result: QueryResult;
  narrow: boolean;
  onSelect: (item: DiscoveryEstablishment) => void;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
}

type CompanyLike = Pick<DiscoveryEstablishment, "nome_fantasia" | "razao_social" | "cnpj_full">;

function CompanyCell({ item, tag }: { item: CompanyLike; tag?: string }) {
  return (
    <>
      <strong className="cell-title">{companyTitle(item)}</strong>
      <span className="cell-secondary">{companySubtitle(item)}</span>
      <span className="cell-code cell-code--secondary">{item.cnpj_full}</span>
      {tag && <span className="reference-tag">{tag}</span>}
    </>
  );
}

function CnaeCell({ item }: { item: Pick<DiscoveryEstablishment, "cnae_principal" | "matched_by_cnae_principal" | "matched_by_cnae_secundario"> }) {
  return (
    <>
      <span className="cell-code">{displayText(item.cnae_principal)}</span>{" "}
      <MatchTag label={matchBadge(item)} />
    </>
  );
}

function companyName(item: CompanyLike) {
  return item.razao_social ?? item.nome_fantasia ?? item.cnpj_full ?? "—";
}

const companyColumn = <T extends DiscoveryEstablishment | NeighborEstablishment>(header = "Empresa", tag?: (item: T) => string | undefined): ResultColumn<T> => ({
  key: "company",
  header,
  render: (item) => <CompanyCell item={item} tag={tag?.(item)} />,
});
const cnaeColumn = <T extends DiscoveryEstablishment | NeighborEstablishment>(): ResultColumn<T> => ({
  key: "cnae",
  header: "Atividade (CNAE)",
  render: (item) => <CnaeCell item={item} />,
});
const statusColumn = <T,>(): ResultColumn<T> => ({ key: "status", header: "Status comercial", render: () => <CommercialStatus /> });

function Pagination({ pagination, onPrevious, onNext, onLimitChange }: { pagination: PaginationMeta } & Pick<QueryResultViewProps, "onPrevious" | "onNext" | "onLimitChange">) {
  return (
    <DiscoveryPagination
      pagination={pagination}
      disabled={false}
      onPrevious={onPrevious}
      onNext={onNext}
      onLimitChange={onLimitChange}
    />
  );
}

function Empty({ children }: { children: string }) {
  return <p className="empty-state results-empty" role="status">{children}</p>;
}

function OriginBanner({ origin, radiusKm, excludesOrigin }: { origin: RadiusSearchOrigin; radiusKm: number; excludesOrigin: boolean }) {
  const place = [origin.municipio_nome, origin.uf].filter(Boolean).join("/") || "município não informado";
  const reference = origin.cnpj_full ? `CNPJ ${origin.cnpj_full} — ${place}` : place;
  return (
    <div className="context-banner" aria-label="Origem resolvida">
      <MapPin aria-hidden="true" size={16} />
      <div>
        <p className="context-banner__title">Origem resolvida: {reference}</p>
        <p>
          Raio de {formatRadius(radiusKm)} · precisão {origin.location_precision === "MUNICIPIO" ? "município (centroide)" : origin.location_precision}
          {origin.codigo_ibge ? ` · IBGE ${origin.codigo_ibge}` : ""}
          {origin.codigo_tom ? ` · TOM ${origin.codigo_tom}` : ""}.
          {" "}Distâncias são aproximadas entre centroides municipais; empresas do mesmo município aparecem a ≈ 0 km.
          {excludesOrigin ? " Vizinhos sempre excluem a própria origem." : origin.kind === "CNPJ" ? " O raio por CNPJ pode incluir a própria origem." : ""}
        </p>
      </div>
    </div>
  );
}

function FilteredView({ result, narrow, onSelect, ...paging }: QueryResultViewProps & { result: Extract<QueryResult, { kind: "filtered" }> }) {
  const { page, snapshot } = result;
  const source: FeedbackSource | null = snapshot.segmentId
    ? { kind: "SEGMENT", reference: feedbackReferenceOrNull(snapshot.segmentId) }
    : null;
  const columns: ResultColumn<DiscoveryEstablishment>[] = [
    companyColumn(),
    {
      key: "location",
      header: "Localização",
      render: (item) => (
        <>
          {locationText(item)}
          {item.codigo_ibge && <span className="cell-secondary">IBGE {item.codigo_ibge}</span>}
        </>
      ),
    },
    cnaeColumn(),
    {
      key: "size",
      header: "Porte e capital",
      render: (item) => (
        <>
          <span>Porte {displayText(item.porte_codigo)}</span>
          <span className="cell-secondary">{formatCapital(item.capital_social)}</span>
        </>
      ),
    },
    statusColumn(),
  ];
  return (
    <>
      {page.items.length === 0 ? <Empty>Nenhuma empresa encontrada para os critérios submetidos.</Empty> : (
        <ResultsCollection
          items={page.items}
          caption="Empresas encontradas pelos critérios submetidos"
          tableClassName="results-table--sticky"
          columns={columns}
          rowKey={(item) => item.cnpj_full}
          narrow={narrow}
          onSelect={onSelect}
          feedbackSource={source}
          feedbackCnpj={(item) => item.cnpj_full}
          itemName={companyName}
          card={(item) => ({
            title: companyTitle(item),
            subtitle: companySubtitle(item),
            code: item.cnpj_full,
            fields: [
              { label: "Local", value: locationText(item) },
              { label: "CNAE", value: <CnaeCell item={item} /> },
              { label: "Porte", value: `${displayText(item.porte_codigo)} · ${formatCapital(item.capital_social)}` },
              { label: "Status", value: <CommercialStatus /> },
            ],
          })}
        />
      )}
      <Pagination pagination={page.pagination} {...paging} />
    </>
  );
}

function RadiusView({ result, narrow, onSelect, ...paging }: QueryResultViewProps & { result: Extract<QueryResult, { kind: "radius" }> }) {
  const { page, snapshot } = result;
  const originCnpj = page.origin.cnpj_full;
  const isOrigin = (item: RadiusSearchEstablishment) => originCnpj !== null && item.cnpj_full === originCnpj;
  const columns: ResultColumn<RadiusSearchEstablishment>[] = [
    companyColumn("Empresa", (item) => (isOrigin(item) ? "Origem da busca" : undefined)),
    { key: "location", header: "Município", render: (item) => locationText(item) },
    { key: "distance", header: "Distância aprox.", render: (item) => formatDistance(item.distance_km) },
    cnaeColumn(),
    statusColumn(),
  ];
  return (
    <>
      <OriginBanner origin={page.origin} radiusKm={snapshot.radiusKm} excludesOrigin={false} />
      {page.items.length === 0 && <Empty>Nenhum estabelecimento foi encontrado.</Empty>}
      <div className="radius-results-layout">
        <div className="radius-table-panel">
          {page.items.length > 0 && (
            <ResultsCollection
              items={page.items}
              caption="Estabelecimentos retornados pela busca por raio"
              tableClassName="results-table--sticky"
              columns={columns}
              rowKey={(item) => item.cnpj_full}
              highlight={isOrigin}
              narrow={narrow}
              onSelect={onSelect}
              feedbackSource={{ kind: "RADIUS", reference: null }}
              feedbackCnpj={(item) => item.cnpj_full}
              itemName={companyName}
              card={(item) => ({
                title: companyTitle(item),
                subtitle: companySubtitle(item),
                code: item.cnpj_full,
                tag: isOrigin(item) ? "Origem da busca" : undefined,
                fields: [
                  { label: "Local", value: locationText(item) },
                  { label: "Distância", value: formatDistance(item.distance_km) },
                  { label: "CNAE", value: <CnaeCell item={item} /> },
                  { label: "Porte", value: `${displayText(item.porte_codigo)} · ${formatCapital(item.capital_social)}` },
                  { label: "Status", value: <CommercialStatus /> },
                ],
              })}
            />
          )}
          <Pagination pagination={page.pagination} {...paging} />
        </div>
        <RadiusMap data={{ origin: page.origin, radiusKm: snapshot.radiusKm, items: page.items }} />
      </div>
    </>
  );
}

function NeighborsView({ result, narrow, ...paging }: QueryResultViewProps & { result: Extract<QueryResult, { kind: "neighbors" }> }) {
  const { page, snapshot } = result;
  const columns: ResultColumn<NeighborEstablishment>[] = [
    companyColumn(),
    { key: "location", header: "Município", render: (item) => locationText(item) },
    { key: "distance", header: "Distância aprox.", render: (item) => formatDistance(item.distance_km) },
    cnaeColumn(),
    statusColumn(),
  ];
  return (
    <>
      <OriginBanner origin={page.origin} radiusKm={snapshot.radiusKm} excludesOrigin />
      {page.items.length === 0 && <Empty>Nenhum estabelecimento vizinho foi encontrado.</Empty>}
      <div className="radius-results-layout">
        <div className="radius-table-panel">
          {page.items.length > 0 && (
            <ResultsCollection
              items={page.items}
              caption="Estabelecimentos vizinhos retornados pela API"
              tableClassName="results-table--sticky"
              columns={columns}
              rowKey={(item) => item.cnpj_full}
              narrow={narrow}
              feedbackSource={{ kind: "NEIGHBORS", reference: feedbackReferenceOrNull(snapshot.cnpj) }}
              feedbackCnpj={(item) => item.cnpj_full}
              itemName={companyName}
              card={(item) => ({
                title: companyTitle(item),
                subtitle: companySubtitle(item),
                code: item.cnpj_full,
                fields: [
                  { label: "Local", value: locationText(item) },
                  { label: "Distância", value: formatDistance(item.distance_km) },
                  { label: "CNAE", value: <CnaeCell item={item} /> },
                  { label: "Status", value: <CommercialStatus /> },
                ],
              })}
            />
          )}
          <Pagination pagination={page.pagination} {...paging} />
        </div>
        <RadiusMap
          data={{ origin: page.origin, radiusKm: snapshot.radiusKm, items: page.items }}
          accessibleName="Mapa dos estabelecimentos vizinhos"
        />
      </div>
    </>
  );
}

function RootView({ result, narrow, onSelect, ...paging }: QueryResultViewProps & { result: Extract<QueryResult, { kind: "root" }> }) {
  const { page } = result;
  const reference = page.root.reference_cnpj_full;
  const isReference = (item: RootBranchEstablishment) => reference !== null && item.cnpj_full === reference;
  const columns: ResultColumn<RootBranchEstablishment>[] = [
    {
      key: "company",
      header: "Estabelecimento",
      render: (item) => (
        <>
          <strong className="cell-title">{displayText(item.razao_social ?? item.nome_fantasia)}</strong>
          <span className="cell-code cell-code--secondary">{item.cnpj_full}</span>
          {isReference(item) && <span className="reference-tag">Referência da busca</span>}
        </>
      ),
    },
    {
      key: "role",
      header: "Papel",
      render: (item) => (
        <>
          {rootBranchRoleLabel(item.establishment_role)}
          <span className="cell-secondary">ordem {item.cnpj_order}</span>
        </>
      ),
    },
    { key: "situation", header: "Situação cadastral", render: (item) => <>Código Receita {item.situacao_cadastral}</> },
    { key: "location", header: "Localização", render: (item) => locationText(item) },
    { key: "start", header: "Início de atividade", render: (item) => displayText(item.data_inicio_atividade) },
    cnaeColumn(),
    statusColumn(),
  ];
  return (
    <>
      <div className="context-banner" aria-label="Contexto da raiz">
        <Network aria-hidden="true" size={16} />
        <div>
          <p className="context-banner__title">
            Raiz <span className="cell-code">{page.root.cnpj_root}</span>
            {reference && <> · referência <span className="cell-code">{reference}</span></>}
          </p>
          <p>
            Mostra somente estabelecimentos conhecidos na base útil (recorte da Receita, escopo {page.root.data_scope});
            inativos, unidades fora dos segmentos úteis e filiais fora do recorte podem estar ausentes. Atendimento
            das filiais é desconhecido sem ERP.
          </p>
        </div>
      </div>
      {page.items.length === 0 && <Empty>Nenhum estabelecimento conhecido foi encontrado nesta página.</Empty>}
      {page.items.length > 0 && (
        <ResultsCollection
          items={page.items}
          caption="Estabelecimentos conhecidos da raiz na base útil do Sentinel"
          tableClassName="results-table--sticky"
          columns={columns}
          rowKey={(item) => item.cnpj_full}
          highlight={isReference}
          narrow={narrow}
          onSelect={onSelect}
          feedbackSource={{ kind: "ROOT_BRANCHES", reference: feedbackReferenceOrNull(page.root.cnpj_root) }}
          feedbackCnpj={(item) => item.cnpj_full}
          itemName={companyName}
          card={(item) => ({
            title: displayText(item.razao_social ?? item.nome_fantasia),
            code: item.cnpj_full,
            tag: isReference(item) ? "Referência da busca" : undefined,
            fields: [
              { label: "Papel", value: `${rootBranchRoleLabel(item.establishment_role)} · ordem ${item.cnpj_order}` },
              { label: "Situação", value: `Código Receita ${item.situacao_cadastral}` },
              { label: "Local", value: locationText(item) },
              { label: "Início", value: displayText(item.data_inicio_atividade) },
              { label: "CNAE", value: <CnaeCell item={item} /> },
              { label: "Status", value: <CommercialStatus /> },
            ],
          })}
        />
      )}
      <Pagination pagination={page.pagination} {...paging} />
    </>
  );
}

function groupKey(item: CommercialGroupItem, index: number) {
  return [item.group_id, item.cnpj_root, item.establishment_known ? item.cnpj_full : index].join("-");
}

function GroupView({ result, narrow, onSelect, ...paging }: QueryResultViewProps & { result: Extract<QueryResult, { kind: "group" }> }) {
  const { page } = result;
  const known = (item: CommercialGroupItem): item is CommercialGroupKnownEstablishment => item.establishment_known;
  const confidence = (item: CommercialGroupItem) => (item.confidence === null ? "não informada" : item.confidence);
  const columns: ResultColumn<CommercialGroupItem>[] = [
    {
      key: "company",
      header: "Estabelecimento e raiz",
      render: (item) => known(item) ? (
        <>
          <strong className="cell-title">{displayText(item.razao_social ?? item.nome_fantasia)}</strong>
          <span className="cell-code cell-code--secondary">{item.cnpj_full}</span>
          <span className="cell-secondary">raiz <span className="cell-code">{item.cnpj_root}</span></span>
        </>
      ) : (
        <>
          <strong className="cell-title">Raiz <span className="cell-code">{item.cnpj_root}</span></strong>
          <span className="cell-secondary">Registrada no grupo, sem estabelecimento na base útil.</span>
        </>
      ),
    },
    { key: "relation", header: "Relação registrada", render: (item) => item.relation_type },
    { key: "source", header: "Fonte", render: (item) => item.relation_source },
    { key: "confidence", header: "Confiança (texto do registro)", render: (item) => confidence(item) },
    { key: "location", header: "Localização", render: (item) => (known(item) ? locationText(item) : "—") },
    statusColumn(),
  ];
  return (
    <>
      <div className="context-banner" aria-label="Contexto do grupo comercial">
        <Network aria-hidden="true" size={16} />
        <div>
          <p className="context-banner__title">
            {page.group.name ?? "Grupo sem nome"} · <span className="cell-code">{page.group.group_id}</span> (registrado)
          </p>
          <p>
            Somente raízes explicitamente registradas no grupo ({page.group.membership_scope}); dados de
            estabelecimentos vêm da base útil ({page.group.establishment_data_scope}). Não representa a estrutura
            societária completa nem confirma relações empresariais.
          </p>
        </div>
      </div>
      {page.items.length === 0 && <Empty>Nenhum item registrado foi encontrado nesta página.</Empty>}
      {page.items.length > 0 && (
        <ResultsCollection<CommercialGroupItem>
          items={page.items}
          caption="Raízes registradas e estabelecimentos conhecidos do grupo comercial"
          tableClassName="results-table--sticky"
          columns={columns}
          rowKey={groupKey}
          narrow={narrow}
          onSelect={(item) => { if (known(item)) onSelect(item); }}
          canSelect={known}
          feedbackSource={{ kind: "COMMERCIAL_GROUP", reference: feedbackReferenceOrNull(page.group.group_id) }}
          feedbackCnpj={(item) => (known(item) ? item.cnpj_full : null)}
          itemName={(item) => (known(item) ? companyName(item) : `raiz ${item.cnpj_root}`)}
          card={(item) => known(item) ? {
            title: displayText(item.razao_social ?? item.nome_fantasia),
            code: item.cnpj_full,
            fields: [
              { label: "Raiz", value: <span className="cell-code">{item.cnpj_root}</span> },
              { label: "Relação", value: `${item.relation_type} · ${item.relation_source}` },
              { label: "Confiança", value: confidence(item) },
              { label: "Local", value: locationText(item) },
              { label: "Status", value: <CommercialStatus /> },
            ],
          } : {
            title: `Raiz ${item.cnpj_root}`,
            subtitle: "Registrada no grupo, sem estabelecimento na base útil.",
            fields: [
              { label: "Relação", value: `${item.relation_type} · ${item.relation_source}` },
              { label: "Confiança", value: confidence(item) },
              { label: "Status", value: <CommercialStatus /> },
            ],
          }}
        />
      )}
      <Pagination pagination={page.pagination} {...paging} />
    </>
  );
}

export function QueryResultView(props: QueryResultViewProps) {
  const { result } = props;
  if (result.kind === "filtered") return <FilteredView {...props} result={result} />;
  if (result.kind === "radius") return <RadiusView {...props} result={result} />;
  if (result.kind === "neighbors") return <NeighborsView {...props} result={result} />;
  if (result.kind === "root") return <RootView {...props} result={result} />;
  return <GroupView {...props} result={result} />;
}
