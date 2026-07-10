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
