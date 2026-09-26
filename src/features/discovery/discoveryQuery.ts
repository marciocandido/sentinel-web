import type { DiscoverySearchSpec } from "../../services/sentinelApi";
import type { DiscoveryEstablishment } from "../../types/api";
import { toDiscoveryExportSearch } from "./discoveryExport";
import type {
  DiscoveryDraft,
  DiscoveryFamily,
  DiscoverySubmission,
  QueryKind,
  SubmittedQuery,
} from "./discoveryTypes";
import { toEditableDiscoverySearch } from "./savedSearches";

export const FAMILY_LABELS: Record<DiscoveryFamily, string> = {
  filters: "Filtros",
  proximity: "Proximidade",
  structure: "Estrutura",
};

/** Rótulo humano da consulta; nunca expõe FILTERED/SEGMENT/REGION. */
export const QUERY_KIND_LABELS: Record<QueryKind, string> = {
  filtered: "Filtros",
  radius: "Proximidade · Raio",
  neighbors: "Proximidade · Vizinhos",
  root: "Estrutura · Raiz e filiais",
  group: "Estrutura · Grupo comercial",
};

export function familyOfKind(kind: QueryKind): DiscoveryFamily {
  if (kind === "filtered") return "filters";
  return kind === "radius" || kind === "neighbors" ? "proximity" : "structure";
}

export function draftQueryKind(draft: DiscoveryDraft): QueryKind {
  if (draft.family === "filters") return "filtered";
  return draft.family === "proximity" ? draft.proximityType : draft.structureType;
}

export function submittedSpec(query: SubmittedQuery): DiscoverySearchSpec {
  return toDiscoveryExportSearch(query);
}

// ---------- Formatação compartilhada entre recibo, tabelas e cards ----------

const RADIUS_ORIGIN_LABELS: Record<string, string> = {
  municipality: "Município",
  cnpj: "CNPJ",
  tom: "Código TOM",
  ibge: "Código IBGE",
  coordinates: "Coordenadas",
};

export function displayText(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim() === "" ? "—" : value;
}

/**
 * Formata um capital decimal textual para leitura, sem conversão numérica:
 * `"480000.00"` → `"R$ 480.000,00"`. Texto fora do formato é devolvido intacto.
 */
export function formatCapital(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") return "—";
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return value;
  const integer = match[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return match[2] === undefined ? `R$ ${integer}` : `R$ ${integer},${match[2]}`;
}

export function formatDistance(km: number): string {
  return `≈ ${km.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
}

export function formatRadius(km: number | string): string {
  return `${typeof km === "number" ? km.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : km} km`;
}

export function locationText(item: { municipio_nome: string | null; uf: string | null }): string {
  return [item.municipio_nome, item.uf].filter(Boolean).join("/") || "—";
}

/** Correspondência de CNAE informada pela API; nunca calculada no navegador. */
export function matchBadge(
  item: Pick<DiscoveryEstablishment, "matched_by_cnae_principal" | "matched_by_cnae_secundario">,
): string | null {
  if (item.matched_by_cnae_principal && item.matched_by_cnae_secundario) return "principal e secundário";
  if (item.matched_by_cnae_principal) return "CNAE principal";
  if (item.matched_by_cnae_secundario) return "via CNAE secundário";
  return null;
}

export function companyTitle(item: { nome_fantasia: string | null; razao_social: string | null; cnpj_full: string | null }): string {
  return item.nome_fantasia?.trim() || item.razao_social?.trim() || item.cnpj_full || "—";
}

export function companySubtitle(item: { nome_fantasia: string | null; razao_social: string | null }): string {
  if (item.nome_fantasia?.trim()) return displayText(item.razao_social);
  return "Sem nome fantasia";
}

export function formatSubmittedAt(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

// ---------- Descrição de critérios (recibo e pesquisas salvas) ----------

export interface CriteriaItem {
  key: string;
  label: string;
  value: string;
}

export type SegmentNameLookup = (segmentId: string) => string;

const identity: SegmentNameLookup = (segmentId) => segmentId;

function push(items: CriteriaItem[], key: string, label: string, value: string | null | undefined) {
  if (value !== null && value !== undefined && value !== "") items.push({ key, label, value });
}

/** Critérios de uma definição, na linguagem do operador. Descartados ficam fora. */
export function describeSearch(spec: DiscoverySearchSpec, segmentName: SegmentNameLookup = identity): CriteriaItem[] {
  const items: CriteriaItem[] = [];
  const segment = (id: string | null | undefined) => (id ? segmentName(id) : undefined);
  if (spec.kind === "FILTERED" || spec.kind === "SEGMENT" || spec.kind === "REGION") {
    push(items, "segmentId", "Segmento", segment(spec.segment_id));
    push(items, "uf", "UF", spec.uf);
    if (spec.kind !== "SEGMENT") push(items, "municipioNome", "Município", spec.municipio_nome);
    push(items, "codigoTom", "Código TOM", spec.codigo_tom);
    if (spec.kind !== "SEGMENT") push(items, "codigoIbge", "Código IBGE", spec.codigo_ibge);
    if (spec.kind !== "REGION") {
      push(items, "porteCodigo", "Porte", spec.porte_codigo);
      push(items, "capitalMin", "Capital mínimo", spec.capital_min ? formatCapital(spec.capital_min) : undefined);
      push(items, "capitalMax", "Capital máximo", spec.capital_max ? formatCapital(spec.capital_max) : undefined);
    }
    return items;
  }
  if (spec.kind === "RADIUS") {
    let origin = "—";
    if (spec.origin_municipio_nome || spec.origin_uf) origin = `município ${[spec.origin_municipio_nome, spec.origin_uf].filter(Boolean).join("/")}`;
    else if (spec.origin_cnpj) origin = `CNPJ ${spec.origin_cnpj}`;
    else if (spec.origin_codigo_tom) origin = `TOM ${spec.origin_codigo_tom}`;
    else if (spec.origin_codigo_ibge) origin = `IBGE ${spec.origin_codigo_ibge}`;
    else if (spec.origin_lat !== null && spec.origin_lat !== undefined) origin = `coordenadas ${spec.origin_lat}, ${spec.origin_lon}`;
    push(items, "origin", "Origem", origin);
    push(items, "radiusKm", "Raio", formatRadius(spec.radius_km));
    push(items, "segmentId", "Segmento", segment(spec.segment_id));
    push(items, "resultUf", "UF dos resultados", spec.uf || "todas");
    return items;
  }
  if (spec.kind === "NEIGHBORS") {
    push(items, "cnpj", "CNPJ de referência", spec.cnpj_full);
    push(items, "radiusKm", "Raio", formatRadius(spec.radius_km));
    push(items, "segmentId", "Segmento", segment(spec.segment_id));
    push(items, "resultUf", "UF dos resultados", spec.uf || "todas");
    items.push({ key: "origin", label: "Origem", value: "excluída dos resultados" });
    return items;
  }
  if (spec.kind === "ROOT_BRANCHES") {
    push(items, "identifierValue", "Identificado por", spec.cnpj ? `CNPJ completo ${spec.cnpj}` : `raiz ${spec.cnpj_root ?? "—"}`);
    return items;
  }
  if (spec.kind === "COMMERCIAL_GROUP") {
    push(items, "groupId", "Grupo", spec.group_id);
    return items;
  }
  push(items, "cnpj", "Referência", `CNPJ ${spec.cnpj_full}`);
  return items;
}

// ---------- Alterações não pesquisadas (draft × snapshot submetido) ----------

export interface DraftChange {
  key: string;
  label: string;
  submitted: string;
  current: string;
}

interface FieldDescriptor {
  key: string;
  label: string;
  format?: (value: string) => string;
  equals?: (left: string, right: string) => boolean;
}

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
function sameNumber(left: string, right: string): boolean {
  if (left === right) return true;
  if (!DECIMAL.test(left) || !DECIMAL.test(right)) return false;
  return Number(left) === Number(right);
}

function describeValue(value: string): string {
  return value === "" ? "—" : value;
}

function draftValues(draft: DiscoveryDraft, kind: QueryKind): Record<string, string> {
  if (kind === "filtered") return { ...draft.filters };
  if (kind === "radius") return { ...draft.radius };
  if (kind === "neighbors") return { ...draft.neighbors };
  if (kind === "root") return { ...draft.root };
  return { ...draft.group };
}

function fieldDescriptors(kind: QueryKind, values: Record<string, string>, segmentName: SegmentNameLookup): FieldDescriptor[] {
  const segment: FieldDescriptor = { key: "segmentId", label: "Segmento", format: (value) => (value ? segmentName(value) : "nenhum") };
  const ufResults: FieldDescriptor = { key: "resultUf", label: "UF dos resultados", format: (value) => value || "todas" };
  const radius: FieldDescriptor = { key: "radiusKm", label: "Raio", format: (value) => (value ? `${value} km` : "—"), equals: sameNumber };
  if (kind === "filtered") {
    return [
      segment,
      { key: "uf", label: "UF", format: (value) => value || "todas" },
      { key: "municipioNome", label: "Município" },
      { key: "codigoTom", label: "Código TOM" },
      { key: "codigoIbge", label: "Código IBGE" },
      { key: "porteCodigo", label: "Porte" },
      { key: "capitalMin", label: "Capital mínimo", format: (value) => (value ? formatCapital(value) : "—") },
      { key: "capitalMax", label: "Capital máximo", format: (value) => (value ? formatCapital(value) : "—") },
    ];
  }
  if (kind === "radius") {
    const origin: FieldDescriptor[] = {
      municipality: [{ key: "originMunicipioNome", label: "Município de origem" }, { key: "originUf", label: "UF da origem" }],
      cnpj: [{ key: "originCnpj", label: "CNPJ de origem" }],
      tom: [{ key: "originCodigoTom", label: "Código TOM da origem" }],
      ibge: [{ key: "originCodigoIbge", label: "Código IBGE da origem" }],
      coordinates: [
        { key: "originLat", label: "Latitude", equals: sameNumber },
        { key: "originLon", label: "Longitude", equals: sameNumber },
      ],
    }[values.originKind] ?? [];
    return [...origin, radius, segment, ufResults];
  }
  if (kind === "neighbors") return [{ key: "cnpj", label: "CNPJ de referência" }, radius, segment, ufResults];
  if (kind === "root") return [{ key: "identifierValue", label: values.identifierKind === "cnpj" ? "CNPJ completo" : "Raiz do CNPJ" }];
  return [{ key: "groupId", label: "ID do grupo" }];
}

/** Valores de formulário equivalentes ao snapshot submetido (para Desfazer). */
export function submittedFormValues(submission: DiscoverySubmission) {
  return toEditableDiscoverySearch(submission.spec);
}

/**
 * Lista as diferenças entre o rascunho atual e a consulta submetida, quando o
 * rascunho visível é do mesmo tipo de consulta. Retorna `null` quando o
 * operador está em outra família/tipo (não há comparação campo a campo).
 */
export function draftChanges(
  draft: DiscoveryDraft,
  submission: DiscoverySubmission | null,
  segmentName: SegmentNameLookup = identity,
): DraftChange[] | null {
  if (!submission || draftQueryKind(draft) !== submission.query.kind) return null;
  const editable = submittedFormValues(submission);
  if (!editable) return null;
  const kind = submission.query.kind;
  const submitted = editable.values as unknown as Record<string, string>;
  const current = draftValues(draft, kind);
  const changes: DraftChange[] = [];
  if (kind === "radius" && submitted.originKind !== current.originKind) {
    changes.push({
      key: "originKind",
      label: "Tipo de origem",
      submitted: RADIUS_ORIGIN_LABELS[submitted.originKind] ?? submitted.originKind,
      current: RADIUS_ORIGIN_LABELS[current.originKind] ?? current.originKind,
    });
  }
  if (kind === "root" && submitted.identifierKind !== current.identifierKind) {
    changes.push({
      key: "identifierKind",
      label: "Identificar por",
      submitted: submitted.identifierKind === "cnpj" ? "CNPJ completo" : "Raiz do CNPJ",
      current: current.identifierKind === "cnpj" ? "CNPJ completo" : "Raiz do CNPJ",
    });
  }
  const comparable = changes.length === 0;
  if (comparable) {
    for (const field of fieldDescriptors(kind, submitted, segmentName)) {
      const left = (submitted[field.key] ?? "").trim();
      const right = (current[field.key] ?? "").trim();
      const equal = field.equals ? field.equals(left, right) : left === right;
      if (!equal) {
        const format = field.format ?? describeValue;
        changes.push({ key: field.key, label: field.label, submitted: format(left), current: format(right) });
      }
    }
  }
  if (editable.includeDiscarded !== draft.includeDiscarded) {
    changes.push({
      key: "includeDiscarded",
      label: "Descartados",
      submitted: editable.includeDiscarded ? "incluídos" : "ocultos",
      current: draft.includeDiscarded ? "incluídos" : "ocultos",
    });
  }
  return changes;
}
