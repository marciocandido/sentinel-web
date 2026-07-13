export interface LivenessResponse {
  status: "ok";
  service: "sentinel-api";
}

export interface SegmentCatalogItem {
  id: string;
  name: string;
}

export interface SegmentCatalogResponse {
  items: SegmentCatalogItem[];
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export interface DiscoveryEstablishment {
  cnpj_full: string;
  cnpj_root: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  uf: string | null;
  municipio_nome: string | null;
  codigo_tom: string | null;
  codigo_ibge: string | null;
  cnae_principal: string | null;
  matched_by_cnae_principal: boolean;
  matched_by_cnae_secundario: boolean;
  location_precision: string | null;
  has_geo: boolean;
  porte_codigo: string | null;
  capital_social: string | null;
  commercial_status: "UNKNOWN";
  commercial_status_source: "none";
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  returned: number;
  has_more: boolean;
}

export interface DiscoveryEstablishmentPage {
  items: DiscoveryEstablishment[];
  pagination: PaginationMeta;
}

export type SimilarityReason =
  | "same_cnae_principal"
  | "same_segment"
  | "same_uf"
  | "same_municipio"
  | "porte_equal_or_higher"
  | "capital_band"
  | "within_radius";

export interface SimilarCompany {
  reference_cnpj_root: string;
  cnpj_full: string;
  cnpj_root: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  uf: string | null;
  municipio_nome: string | null;
  codigo_tom: string | null;
  codigo_ibge: string | null;
  cnae_principal: string | null;
  porte_codigo: string | null;
  capital_social: string | null;
  location_precision: string | null;
  has_geo: boolean;
  distance_km: number | null;
  matched_same_cnae_principal: boolean;
  matched_same_segment: boolean;
  matched_same_uf: boolean;
  matched_same_municipio: boolean;
  matched_porte_equal_or_higher: boolean;
  matched_capital_band: boolean;
  similarity_rank: number;
  similarity_reasons: SimilarityReason[];
  commercial_status: "UNKNOWN";
  commercial_status_source: "none";
}

export interface SimilarCompanyPage {
  items: SimilarCompany[];
  pagination: PaginationMeta;
}

export type RadiusSearchOriginKind = "COORDINATE" | "CNPJ" | "MUNICIPALITY";

export interface RadiusSearchOrigin {
  kind: RadiusSearchOriginKind;
  cnpj_full: string | null;
  codigo_tom: string | null;
  codigo_ibge: string | null;
  municipio_nome: string | null;
  uf: string | null;
  latitude: number;
  longitude: number;
  location_precision: string;
}

export interface RadiusSearchEstablishment extends DiscoveryEstablishment {
  latitude: number;
  longitude: number;
  distance_km: number;
  location_precision: string;
  has_geo: true;
}

export interface RadiusSearchPage {
  origin: RadiusSearchOrigin;
  items: RadiusSearchEstablishment[];
  pagination: PaginationMeta;
}

const SIMILARITY_REASONS: readonly SimilarityReason[] = [
  "same_cnae_principal",
  "same_segment",
  "same_uf",
  "same_municipio",
  "porte_equal_or_higher",
  "capital_band",
  "within_radius",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isLivenessResponse(value: unknown): value is LivenessResponse {
  return isRecord(value) && value.status === "ok" && value.service === "sentinel-api";
}

export function isSegmentCatalogResponse(value: unknown): value is SegmentCatalogResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string",
    )
  );
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isDiscoveryEstablishment(value: unknown): value is DiscoveryEstablishment {
  return (
    isRecord(value) &&
    typeof value.cnpj_full === "string" &&
    typeof value.cnpj_root === "string" &&
    isNullableString(value.razao_social) &&
    isNullableString(value.nome_fantasia) &&
    isNullableString(value.uf) &&
    isNullableString(value.municipio_nome) &&
    isNullableString(value.codigo_tom) &&
    isNullableString(value.codigo_ibge) &&
    isNullableString(value.cnae_principal) &&
    typeof value.matched_by_cnae_principal === "boolean" &&
    typeof value.matched_by_cnae_secundario === "boolean" &&
    isNullableString(value.location_precision) &&
    typeof value.has_geo === "boolean" &&
    isNullableString(value.porte_codigo) &&
    isNullableString(value.capital_social) &&
    value.commercial_status === "UNKNOWN" &&
    value.commercial_status_source === "none"
  );
}

export function isPaginationMeta(value: unknown): value is PaginationMeta {
  return (
    isRecord(value) &&
    Number.isInteger(value.limit) &&
    (value.limit as number) > 0 &&
    Number.isInteger(value.offset) &&
    (value.offset as number) >= 0 &&
    Number.isInteger(value.returned) &&
    (value.returned as number) >= 0 &&
    typeof value.has_more === "boolean"
  );
}

export function isDiscoveryEstablishmentPage(value: unknown): value is DiscoveryEstablishmentPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isDiscoveryEstablishment) &&
    isPaginationMeta(value.pagination)
  );
}

export function isSimilarityReason(value: unknown): value is SimilarityReason {
  return typeof value === "string" && SIMILARITY_REASONS.includes(value as SimilarityReason);
}

export function isSimilarCompany(value: unknown): value is SimilarCompany {
  return (
    isRecord(value) &&
    typeof value.reference_cnpj_root === "string" &&
    typeof value.cnpj_full === "string" &&
    typeof value.cnpj_root === "string" &&
    isNullableString(value.razao_social) &&
    isNullableString(value.nome_fantasia) &&
    isNullableString(value.uf) &&
    isNullableString(value.municipio_nome) &&
    isNullableString(value.codigo_tom) &&
    isNullableString(value.codigo_ibge) &&
    isNullableString(value.cnae_principal) &&
    isNullableString(value.porte_codigo) &&
    isNullableString(value.capital_social) &&
    isNullableString(value.location_precision) &&
    typeof value.has_geo === "boolean" &&
    (value.distance_km === null ||
      (typeof value.distance_km === "number" &&
        Number.isFinite(value.distance_km) &&
        value.distance_km >= 0)) &&
    typeof value.matched_same_cnae_principal === "boolean" &&
    typeof value.matched_same_segment === "boolean" &&
    typeof value.matched_same_uf === "boolean" &&
    typeof value.matched_same_municipio === "boolean" &&
    typeof value.matched_porte_equal_or_higher === "boolean" &&
    typeof value.matched_capital_band === "boolean" &&
    Number.isInteger(value.similarity_rank) &&
    (value.similarity_rank as number) >= 1 &&
    (value.similarity_rank as number) <= 5 &&
    Array.isArray(value.similarity_reasons) &&
    value.similarity_reasons.every(isSimilarityReason) &&
    value.commercial_status === "UNKNOWN" &&
    value.commercial_status_source === "none"
  );
}

export function isSimilarCompanyPage(value: unknown): value is SimilarCompanyPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isSimilarCompany) &&
    isPaginationMeta(value.pagination)
  );
}

function isCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function isRadiusSearchOrigin(value: unknown): value is RadiusSearchOrigin {
  return (
    isRecord(value) &&
    (value.kind === "COORDINATE" || value.kind === "CNPJ" || value.kind === "MUNICIPALITY") &&
    isNullableString(value.cnpj_full) &&
    isNullableString(value.codigo_tom) &&
    isNullableString(value.codigo_ibge) &&
    isNullableString(value.municipio_nome) &&
    isNullableString(value.uf) &&
    isCoordinate(value.latitude, -90, 90) &&
    isCoordinate(value.longitude, -180, 180) &&
    typeof value.location_precision === "string"
  );
}

export function isRadiusSearchEstablishment(value: unknown): value is RadiusSearchEstablishment {
  const row = value as Record<string, unknown>;
  return (
    isDiscoveryEstablishment(value) &&
    isCoordinate(row.latitude, -90, 90) &&
    isCoordinate(row.longitude, -180, 180) &&
    typeof row.distance_km === "number" &&
    Number.isFinite(row.distance_km) &&
    row.distance_km >= 0 &&
    value.location_precision !== null &&
    value.has_geo === true
  );
}

export function isRadiusSearchPage(value: unknown): value is RadiusSearchPage {
  return (
    isRecord(value) &&
    isRadiusSearchOrigin(value.origin) &&
    Array.isArray(value.items) &&
    value.items.every(isRadiusSearchEstablishment) &&
    isPaginationMeta(value.pagination)
  );
}
