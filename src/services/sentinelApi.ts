import {
  isDiscoveryEstablishmentPage,
  isLivenessResponse,
  isSegmentCatalogResponse,
  isSimilarCompanyPage,
  isRadiusSearchPage,
  type DiscoveryEstablishmentPage,
  type LivenessResponse,
  type SegmentCatalogResponse,
  type SimilarCompanyPage,
  type RadiusSearchPage,
} from "../types/api";
import { getJson, SentinelApiError, type RequestOptions } from "./apiClient";

export interface SegmentSearchParams {
  segmentId: string;
  uf?: string;
  codigoTom?: string;
  porteCodigo?: string;
  capitalMin?: string;
  capitalMax?: string;
  limit: number;
  offset: number;
}

export interface RegionSearchParams {
  uf?: string;
  codigoTom?: string;
  codigoIbge?: string;
  municipioNome?: string;
  segmentId?: string;
  limit: number;
  offset: number;
}

export interface SimilarCompaniesParams {
  cnpjFull: string;
  limit: number;
  offset: number;
}

export type RadiusSearchSnapshotOrigin =
  | { kind: "municipality"; municipioNome: string; uf: string }
  | { kind: "cnpj"; cnpj: string }
  | { kind: "tom"; codigoTom: string }
  | { kind: "ibge"; codigoIbge: string }
  | { kind: "coordinates"; lat: number; lon: number };

export interface RadiusSearchParams {
  origin: RadiusSearchSnapshotOrigin;
  radiusKm: number;
  segmentId?: string;
  resultUf?: string;
  limit: number;
  offset: number;
}

function setIfPresent(query: URLSearchParams, name: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) query.set(name, trimmed);
}

function paginationQuery(limit: number, offset: number) {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  return query;
}

function assertDiscoveryPage(response: unknown): DiscoveryEstablishmentPage {
  if (!isDiscoveryEstablishmentPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function getLiveness(options?: RequestOptions): Promise<LivenessResponse> {
  const response = await getJson("/health/live", options);
  if (!isLivenessResponse(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function listSegments(options?: RequestOptions): Promise<SegmentCatalogResponse> {
  const response = await getJson("/api/v1/catalog/segments", options);
  if (!isSegmentCatalogResponse(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function searchEstablishmentsBySegment(
  params: SegmentSearchParams,
  options?: RequestOptions,
): Promise<DiscoveryEstablishmentPage> {
  const query = paginationQuery(params.limit, params.offset);
  setIfPresent(query, "uf", params.uf);
  setIfPresent(query, "codigo_tom", params.codigoTom);
  setIfPresent(query, "porte_codigo", params.porteCodigo);
  setIfPresent(query, "capital_min", params.capitalMin);
  setIfPresent(query, "capital_max", params.capitalMax);
  const response = await getJson(
    `/api/v1/discovery/segments/${encodeURIComponent(params.segmentId)}/establishments?${query}`,
    options,
  );
  return assertDiscoveryPage(response);
}

export async function searchEstablishmentsByRegion(
  params: RegionSearchParams,
  options?: RequestOptions,
): Promise<DiscoveryEstablishmentPage> {
  const query = paginationQuery(params.limit, params.offset);
  setIfPresent(query, "uf", params.uf);
  setIfPresent(query, "codigo_tom", params.codigoTom);
  setIfPresent(query, "codigo_ibge", params.codigoIbge);
  setIfPresent(query, "municipio_nome", params.municipioNome);
  setIfPresent(query, "segment_id", params.segmentId);
  const response = await getJson(`/api/v1/discovery/regions/establishments?${query}`, options);
  return assertDiscoveryPage(response);
}

export async function searchSimilarCompanies(
  params: SimilarCompaniesParams,
  options?: RequestOptions,
): Promise<SimilarCompanyPage> {
  const query = paginationQuery(params.limit, params.offset);
  const response = await getJson(
    `/api/v1/discovery/establishments/${encodeURIComponent(params.cnpjFull)}/similar?${query}`,
    options,
  );
  if (!isSimilarCompanyPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function searchEstablishmentsByRadius(
  params: RadiusSearchParams,
  options?: RequestOptions,
): Promise<RadiusSearchPage> {
  const query = paginationQuery(params.limit, params.offset);
  query.set("radius_km", String(params.radiusKm));
  if (params.origin.kind === "municipality") {
    query.set("origin_municipio_nome", params.origin.municipioNome);
    query.set("origin_uf", params.origin.uf);
  } else if (params.origin.kind === "cnpj") query.set("origin_cnpj", params.origin.cnpj);
  else if (params.origin.kind === "tom") query.set("origin_codigo_tom", params.origin.codigoTom);
  else if (params.origin.kind === "ibge") query.set("origin_codigo_ibge", params.origin.codigoIbge);
  else {
    query.set("origin_lat", String(params.origin.lat));
    query.set("origin_lon", String(params.origin.lon));
  }
  setIfPresent(query, "segment_id", params.segmentId);
  setIfPresent(query, "uf", params.resultUf);
  const response = await getJson(`/api/v1/discovery/radius/establishments?${query}`, options);
  if (!isRadiusSearchPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}
