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
export function toEditableDiscoverySearch(spec: DiscoverySearchSpec): EditableDiscoverySearch | null {
  const includeDiscarded = spec.include_discarded === true;
  if (spec.kind === "SEGMENT") return { mode:"segment", includeDiscarded, values:{ ...blankStandard(), segmentId:spec.segment_id, uf:spec.uf ?? "", codigoTom:spec.codigo_tom ?? "", porteCodigo:spec.porte_codigo ?? "", capitalMin:spec.capital_min ?? "", capitalMax:spec.capital_max ?? "" } };
  if (spec.kind === "REGION") return { mode:"region", includeDiscarded, values:{ ...blankStandard(), segmentId:spec.segment_id ?? "", uf:spec.uf ?? "", codigoTom:spec.codigo_tom ?? "", codigoIbge:spec.codigo_ibge ?? "", municipioNome:spec.municipio_nome ?? "" } };
  if (spec.kind === "RADIUS") {
    const origins = [spec.origin_municipio_nome !== undefined || spec.origin_uf !== undefined, spec.origin_cnpj !== undefined, spec.origin_codigo_tom !== undefined, spec.origin_codigo_ibge !== undefined, spec.origin_lat !== undefined || spec.origin_lon !== undefined];
    if (origins.filter(Boolean).length !== 1) return null;
    const base = { originMunicipioNome:"", originUf:"", originCnpj:"", originCodigoTom:"", originCodigoIbge:"", originLat:"", originLon:"", radiusKm:String(spec.radius_km), segmentId:spec.segment_id ?? "", resultUf:spec.uf ?? "" };
    if (origins[0]) { if (!spec.origin_municipio_nome || !spec.origin_uf) return null; return { mode:"radius",includeDiscarded,values:{...base,originKind:"municipality",originMunicipioNome:spec.origin_municipio_nome,originUf:spec.origin_uf} }; }
    if (origins[1]) return {mode:"radius",includeDiscarded,values:{...base,originKind:"cnpj",originCnpj:spec.origin_cnpj!}};
    if (origins[2]) return {mode:"radius",includeDiscarded,values:{...base,originKind:"tom",originCodigoTom:spec.origin_codigo_tom!}};
    if (origins[3]) return {mode:"radius",includeDiscarded,values:{...base,originKind:"ibge",originCodigoIbge:spec.origin_codigo_ibge!}};
    if (spec.origin_lat === undefined || spec.origin_lon === undefined) return null;
    return {mode:"radius",includeDiscarded,values:{...base,originKind:"coordinates",originLat:String(spec.origin_lat),originLon:String(spec.origin_lon)}};
  }
  if (spec.kind === "NEIGHBORS") return {mode:"neighbors",includeDiscarded,values:{cnpj:spec.cnpj_full,radiusKm:String(spec.radius_km),segmentId:spec.segment_id ?? "",resultUf:spec.uf ?? ""}};
  if (spec.kind === "ROOT_BRANCHES") { const root = spec as { cnpj?: string; cnpj_root?: string }; return typeof root.cnpj === "string" ? {mode:"root",includeDiscarded,values:{identifierKind:"cnpj",identifierValue:root.cnpj}} : typeof root.cnpj_root === "string" ? {mode:"root",includeDiscarded,values:{identifierKind:"root",identifierValue:root.cnpj_root}} : null; }
  if (spec.kind === "COMMERCIAL_GROUP") return {mode:"group",includeDiscarded,values:{groupId:spec.group_id}};
  return null;
}
export const savedSearchKindLabel: Record<DiscoverySearchSpec["kind"], string> = { SEGMENT:"Segmento", REGION:"Região", RADIUS:"Raio", NEIGHBORS:"Vizinhos", ROOT_BRANCHES:"Raiz/filiais", COMMERCIAL_GROUP:"Grupo comercial", SIMILAR:"Semelhantes" };
