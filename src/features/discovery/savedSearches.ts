import type { DiscoverySearchSpec } from "../../services/sentinelApi";
import type { CommercialGroupFormValues } from "./commercialGroupTypes";
import type { DiscoveryFormValues } from "./discoveryTypes";
import type { NeighborsFormValues } from "./neighborsTypes";
import type { RadiusFormValues } from "./radiusTypes";
import type { RootBranchesFormValues } from "./rootBranchesTypes";

export type EditableDiscoverySearch =
  | { mode: "segment" | "region"; values: DiscoveryFormValues; includeDiscarded: boolean }
  | { mode: "radius"; values: RadiusFormValues; includeDiscarded: boolean }
  | { mode: "neighbors"; values: NeighborsFormValues; includeDiscarded: boolean }
  | { mode: "root"; values: RootBranchesFormValues; includeDiscarded: boolean }
  | { mode: "group"; values: CommercialGroupFormValues; includeDiscarded: boolean };

const blankStandard = (): DiscoveryFormValues => ({ segmentId:"", uf:"", codigoTom:"", codigoIbge:"", municipioNome:"", porteCodigo:"", capitalMin:"", capitalMax:"" });
const present = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;
export function toEditableDiscoverySearch(spec: DiscoverySearchSpec): EditableDiscoverySearch | null {
  const includeDiscarded = spec.include_discarded === true;
  if (spec.kind === "SEGMENT") return { mode:"segment", includeDiscarded, values:{ ...blankStandard(), segmentId:spec.segment_id, uf:spec.uf ?? "", codigoTom:spec.codigo_tom ?? "", porteCodigo:spec.porte_codigo ?? "", capitalMin:spec.capital_min ?? "", capitalMax:spec.capital_max ?? "" } };
  if (spec.kind === "REGION") return { mode:"region", includeDiscarded, values:{ ...blankStandard(), segmentId:spec.segment_id ?? "", uf:spec.uf ?? "", codigoTom:spec.codigo_tom ?? "", codigoIbge:spec.codigo_ibge ?? "", municipioNome:spec.municipio_nome ?? "" } };
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
export const savedSearchKindLabel: Record<DiscoverySearchSpec["kind"], string> = { SEGMENT:"Segmento", REGION:"Região", RADIUS:"Raio", NEIGHBORS:"Vizinhos", ROOT_BRANCHES:"Raiz/filiais", COMMERCIAL_GROUP:"Grupo comercial", SIMILAR:"Semelhantes" };
