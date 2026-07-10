import {
  isDiscoveryEstablishmentPage,
  isLivenessResponse,
  isSegmentCatalogResponse,
  type DiscoveryEstablishmentPage,
  type LivenessResponse,
  type SegmentCatalogResponse,
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
