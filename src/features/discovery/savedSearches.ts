import type { DiscoverySearchSpec } from "../../services/sentinelApi";
import type { CommercialGroupFormValues } from "./commercialGroupTypes";
import type { DiscoveryFormValues } from "./discoveryTypes";
import type { NeighborsFormValues } from "./neighborsTypes";
import type { RadiusFormValues } from "./radiusTypes";
import type { RootBranchesFormValues } from "./rootBranchesTypes";

/**
 * Definição reidratável no editor. SEGMENT e REGION legados abrem a família
 * Filtros; o registro salvo nunca é reescrito e `origin` só identifica o kind
 * de onde os critérios vieram. A próxima busca manual cria um FILTERED novo.
 */
export type EditableDiscoverySearch =
  | { mode: "filtered"; origin: "FILTERED" | "SEGMENT" | "REGION"; values: DiscoveryFormValues; includeDiscarded: boolean }
  | { mode: "radius"; values: RadiusFormValues; includeDiscarded: boolean }
  | { mode: "neighbors"; values: NeighborsFormValues; includeDiscarded: boolean }
  | { mode: "root"; values: RootBranchesFormValues; includeDiscarded: boolean }
  | { mode: "group"; values: CommercialGroupFormValues; includeDiscarded: boolean };

const blankStandard = (): DiscoveryFormValues => ({ segmentId:"", uf:"", codigoTom:"", codigoIbge:"", municipioNome:"", porteCodigo:"", capitalMin:"", capitalMax:"" });
const present = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;
export function toEditableDiscoverySearch(spec: DiscoverySearchSpec): EditableDiscoverySearch | null {
  const includeDiscarded = spec.include_discarded === true;
  if (spec.kind === "FILTERED") return { mode:"filtered", origin:"FILTERED", includeDiscarded, values:{ segmentId:spec.segment_id ?? "", uf:spec.uf ?? "", municipioNome:spec.municipio_nome ?? "", codigoTom:spec.codigo_tom ?? "", codigoIbge:spec.codigo_ibge ?? "", porteCodigo:spec.porte_codigo ?? "", capitalMin:spec.capital_min ?? "", capitalMax:spec.capital_max ?? "" } };
  if (spec.kind === "SEGMENT") return { mode:"filtered", origin:"SEGMENT", includeDiscarded, values:{ ...blankStandard(), segmentId:spec.segment_id, uf:spec.uf ?? "", codigoTom:spec.codigo_tom ?? "", porteCodigo:spec.porte_codigo ?? "", capitalMin:spec.capital_min ?? "", capitalMax:spec.capital_max ?? "" } };
  if (spec.kind === "REGION") return { mode:"filtered", origin:"REGION", includeDiscarded, values:{ ...blankStandard(), segmentId:spec.segment_id ?? "", uf:spec.uf ?? "", codigoTom:spec.codigo_tom ?? "", codigoIbge:spec.codigo_ibge ?? "", municipioNome:spec.municipio_nome ?? "" } };
  if (spec.kind === "RADIUS") {
    const origins = [present(spec.origin_municipio_nome) || present(spec.origin_uf), present(spec.origin_cnpj), present(spec.origin_codigo_tom), present(spec.origin_codigo_ibge), present(spec.origin_lat) || present(spec.origin_lon)];
    if (origins.filter(Boolean).length !== 1) return null;
    const base = { originMunicipioNome:"", originUf:"", originCnpj:"", originCodigoTom:"", originCodigoIbge:"", originLat:"", originLon:"", radiusKm:String(spec.radius_km), segmentId:spec.segment_id ?? "", resultUf:spec.uf ?? "" };
    if (origins[0]) { if (!spec.origin_municipio_nome || !spec.origin_uf) return null; return { mode:"radius",includeDiscarded,values:{...base,originKind:"municipality",originMunicipioNome:spec.origin_municipio_nome,originUf:spec.origin_uf} }; }
    if (origins[1]) return {mode:"radius",includeDiscarded,values:{...base,originKind:"cnpj",originCnpj:spec.origin_cnpj!}};
    if (origins[2]) return {mode:"radius",includeDiscarded,values:{...base,originKind:"tom",originCodigoTom:spec.origin_codigo_tom!}};
    if (origins[3]) return {mode:"radius",includeDiscarded,values:{...base,originKind:"ibge",originCodigoIbge:spec.origin_codigo_ibge!}};
    if (!present(spec.origin_lat) || !present(spec.origin_lon)) return null;
    return {mode:"radius",includeDiscarded,values:{...base,originKind:"coordinates",originLat:String(spec.origin_lat),originLon:String(spec.origin_lon)}};
  }
  if (spec.kind === "NEIGHBORS") return {mode:"neighbors",includeDiscarded,values:{cnpj:spec.cnpj_full,radiusKm:String(spec.radius_km),segmentId:spec.segment_id ?? "",resultUf:spec.uf ?? ""}};
  if (spec.kind === "ROOT_BRANCHES") {
    const hasCnpj = present(spec.cnpj); const hasRoot = present(spec.cnpj_root);
    if (hasCnpj === hasRoot) return null;
    return hasCnpj ? {mode:"root",includeDiscarded,values:{identifierKind:"cnpj",identifierValue:spec.cnpj!}} : {mode:"root",includeDiscarded,values:{identifierKind:"root",identifierValue:spec.cnpj_root!}};
  }
  if (spec.kind === "COMMERCIAL_GROUP") return {mode:"group",includeDiscarded,values:{groupId:spec.group_id}};
  return null;
}

/** Nome humano da família/tipo de uma definição; nunca o discriminador técnico. */
export const savedSearchKindLabel: Record<DiscoverySearchSpec["kind"], string> = {
  FILTERED: "Filtros",
  SEGMENT: "Filtros · Segmento",
  REGION: "Filtros · Região",
  RADIUS: "Proximidade · Raio",
  NEIGHBORS: "Proximidade · Vizinhos",
  ROOT_BRANCHES: "Estrutura · Raiz e filiais",
  COMMERCIAL_GROUP: "Estrutura · Grupo comercial",
  SIMILAR: "Semelhantes",
};

export function publicSavedSearchError(code: string): string {
  const messages: Record<string, string> = {
    invalid_request: "A API rejeitou os dados da pesquisa salva.",
    saved_search_not_found: "Esta pesquisa já não existe.",
    saved_search_name_conflict: "Já existe uma pesquisa com esse nome.",
    database_unavailable: "O banco do Sentinel está indisponível.",
    internal_server_error: "Não foi possível concluir a operação.",
    request_timeout: "A operação excedeu o tempo limite.",
    network_error: "Não foi possível conectar à API.",
    invalid_response: "A API retornou uma resposta inválida.",
  };
  return messages[code] ?? "Não foi possível concluir a operação.";
}
