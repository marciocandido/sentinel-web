import {
  isDiscoveryEstablishmentPage,
  isLivenessResponse,
  isSegmentCatalogResponse,
  isSimilarCompanyPage,
  isRadiusSearchPage,
  isNeighborSearchPage,
  isRootBranchesPage,
  isCommercialGroupPage,
  isFeedbackCreateResponse,
  isFeedbackHistoryPage,
  isRuntimeStatusResponse,
  isBootstrapPreflightResponse,
  isBootstrapJobResponse,
  isUpdatePreflightResponse,
  type CommercialGroupPage,
  type DiscoveryEstablishmentPage,
  type LivenessResponse,
  type SegmentCatalogResponse,
  type SimilarCompanyPage,
  type RadiusSearchPage,
  type NeighborSearchPage,
  type RootBranchesPage,
  type FeedbackAction,
  type FeedbackCreateResponse,
  type FeedbackHistoryPage,
  type FeedbackSource,
  type RuntimeStatusResponse,
  type BootstrapPreflightResponse,
  type BootstrapJobResponse,
  type UpdatePreflightResponse,
} from "../types/api";
import { getJson, postBinary, postJson, SentinelApiError, type RequestOptions } from "./apiClient";

export interface SegmentSearchParams {
  segmentId: string;
  uf?: string;
  codigoTom?: string;
  porteCodigo?: string;
  capitalMin?: string;
  capitalMax?: string;
  includeDiscarded?: boolean;
  limit: number;
  offset: number;
}

export interface RegionSearchParams {
  uf?: string;
  codigoTom?: string;
  codigoIbge?: string;
  municipioNome?: string;
  segmentId?: string;
  includeDiscarded?: boolean;
  limit: number;
  offset: number;
}

export interface SimilarCompaniesParams {
  cnpjFull: string;
  includeDiscarded?: boolean;
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
  includeDiscarded?: boolean;
  limit: number;
  offset: number;
}

export interface NeighborSearchParams {
  cnpjFull: string;
  radiusKm: number;
  segmentId?: string;
  resultUf?: string;
  includeDiscarded?: boolean;
  limit: number;
  offset: number;
}

export type RootBranchesIdentifier =
  | { kind: "cnpj"; cnpj: string }
  | { kind: "root"; cnpjRoot: string };

export interface RootBranchesSearchParams {
  identifier: RootBranchesIdentifier;
  includeDiscarded?: boolean;
  limit: number;
  offset: number;
}

export interface CommercialGroupSearchParams {
  groupId: string;
  includeDiscarded?: boolean;
  limit: number;
  offset: number;
}

export type DiscoveryExportFormat = "CSV" | "XLSX";

export interface SegmentExportSearch {
  kind: "SEGMENT";
  segment_id: string;
  uf?: string;
  codigo_tom?: string;
  porte_codigo?: string;
  capital_min?: string;
  capital_max?: string;
  include_discarded?: boolean;
}

export interface RegionExportSearch {
  kind: "REGION";
  uf?: string;
  codigo_tom?: string;
  codigo_ibge?: string;
  municipio_nome?: string;
  segment_id?: string;
  include_discarded?: boolean;
}

export interface RadiusExportSearch {
  kind: "RADIUS";
  radius_km: number;
  origin_lat?: number;
  origin_lon?: number;
  origin_cnpj?: string;
  origin_codigo_tom?: string;
  origin_codigo_ibge?: string;
  origin_municipio_nome?: string;
  origin_uf?: string;
  segment_id?: string;
  uf?: string;
  include_discarded?: boolean;
}

export interface NeighborsExportSearch {
  kind: "NEIGHBORS";
  cnpj_full: string;
  radius_km: number;
  segment_id?: string;
  uf?: string;
  include_discarded?: boolean;
}

export type RootBranchesExportSearch = (
  | { kind: "ROOT_BRANCHES"; cnpj: string }
  | { kind: "ROOT_BRANCHES"; cnpj_root: string }
) & { include_discarded?: boolean };

export interface CommercialGroupExportSearch {
  kind: "COMMERCIAL_GROUP";
  group_id: string;
  include_discarded?: boolean;
}

export interface SimilarExportSearch {
  kind: "SIMILAR";
  cnpj_full: string;
  include_discarded?: boolean;
}

export type DiscoveryExportSearch =
  | SegmentExportSearch
  | RegionExportSearch
  | RadiusExportSearch
  | NeighborsExportSearch
  | RootBranchesExportSearch
  | CommercialGroupExportSearch
  | SimilarExportSearch;

export interface DiscoveryExportRequest {
  format: DiscoveryExportFormat;
  search: DiscoveryExportSearch;
}

export interface DiscoveryExportFile {
  blob: Blob;
  filename: string;
  format: DiscoveryExportFormat;
}

export interface FeedbackCreateParams {
  cnpjFull: string;
  action: FeedbackAction;
  source?: FeedbackSource | null;
  idempotencyKey: string;
}

export interface FeedbackHistoryParams {
  cnpjFull: string;
  limit: number;
  offset: number;
}

function setIfPresent(query: URLSearchParams, name: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) query.set(name, trimmed);
}

function setIncludeDiscarded(query: URLSearchParams, includeDiscarded?: boolean) {
  if (includeDiscarded === true) query.set("include_discarded", "true");
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

const RUNTIME_TIMEOUT_MS = 4_000;

export async function getRuntimeStatus(options?: RequestOptions): Promise<RuntimeStatusResponse> {
  const response = await getJson("/api/v1/runtime/status", { ...options, timeoutMs: RUNTIME_TIMEOUT_MS });
  if (!isRuntimeStatusResponse(response)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return response;
}

export async function getBootstrapPreflight(competence?: string, options?: RequestOptions): Promise<BootstrapPreflightResponse> {
  const query = competence?.trim() ? `?competence=${encodeURIComponent(competence.trim())}` : "";
  const response = await getJson(`/api/v1/base/bootstrap/preflight${query}`, { ...options, timeoutMs: RUNTIME_TIMEOUT_MS });
  if (!isBootstrapPreflightResponse(response)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return response;
}

export async function startBootstrap(competence: string, options?: RequestOptions): Promise<BootstrapJobResponse> {
  const response = await postJson("/api/v1/base/bootstrap", { competence }, { ...options, timeoutMs: RUNTIME_TIMEOUT_MS, acceptedStatuses: [200, 202] });
  if (!isBootstrapJobResponse(response)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return response;
}

export async function getUpdatePreflight(competence?: string, options?: RequestOptions): Promise<UpdatePreflightResponse> {
  const query = new URLSearchParams();
  if (competence?.trim()) query.set("competence", competence.trim());
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await getJson(`/api/v1/base/update/preflight${suffix}`, { ...options, timeoutMs: RUNTIME_TIMEOUT_MS });
  if (!isUpdatePreflightResponse(response)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return response;
}

export async function startMonthlyUpdate(competence: string, options?: RequestOptions): Promise<BootstrapJobResponse> {
  const response = await postJson("/api/v1/base/update", { competence }, { ...options, timeoutMs: RUNTIME_TIMEOUT_MS, acceptedStatuses: [200, 202] });
  if (!isBootstrapJobResponse(response)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
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
  setIncludeDiscarded(query, params.includeDiscarded);
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
  setIncludeDiscarded(query, params.includeDiscarded);
  const response = await getJson(`/api/v1/discovery/regions/establishments?${query}`, options);
  return assertDiscoveryPage(response);
}

export async function searchSimilarCompanies(
  params: SimilarCompaniesParams,
  options?: RequestOptions,
): Promise<SimilarCompanyPage> {
  const query = paginationQuery(params.limit, params.offset);
  setIncludeDiscarded(query, params.includeDiscarded);
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
  setIncludeDiscarded(query, params.includeDiscarded);
  const response = await getJson(`/api/v1/discovery/radius/establishments?${query}`, options);
  if (!isRadiusSearchPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function searchNeighboringEstablishments(
  params: NeighborSearchParams,
  options?: RequestOptions,
): Promise<NeighborSearchPage> {
  const query = paginationQuery(params.limit, params.offset);
  query.set("radius_km", String(params.radiusKm));
  setIfPresent(query, "segment_id", params.segmentId);
  setIfPresent(query, "uf", params.resultUf);
  setIncludeDiscarded(query, params.includeDiscarded);
  const response = await getJson(
    `/api/v1/discovery/establishments/${encodeURIComponent(params.cnpjFull)}/neighbors?${query}`,
    options,
  );
  if (!isNeighborSearchPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function searchRootBranches(
  params: RootBranchesSearchParams,
  options?: RequestOptions,
): Promise<RootBranchesPage> {
  const query = paginationQuery(params.limit, params.offset);
  if (params.identifier.kind === "cnpj") {
    query.set("cnpj", params.identifier.cnpj);
  } else {
    query.set("cnpj_root", params.identifier.cnpjRoot);
  }
  setIncludeDiscarded(query, params.includeDiscarded);
  const response = await getJson(
    `/api/v1/discovery/root-branches?${query}`,
    options,
  );
  if (!isRootBranchesPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function searchCommercialGroup(
  params: CommercialGroupSearchParams,
  options?: RequestOptions,
): Promise<CommercialGroupPage> {
  const query = paginationQuery(params.limit, params.offset);
  query.set("group_id", params.groupId);
  setIncludeDiscarded(query, params.includeDiscarded);
  const response = await getJson(
    `/api/v1/discovery/commercial-groups?${query}`,
    options,
  );
  if (!isCommercialGroupPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

const EXPORT_MEDIA_TYPES: Record<DiscoveryExportFormat, string> = {
  CSV: "text/csv",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function exportFilename(
  contentDisposition: string | null,
  format: DiscoveryExportFormat,
  kind: DiscoveryExportSearch["kind"],
): string {
  const match = contentDisposition?.match(/^\s*attachment\s*;\s*filename\s*=\s*"([^"]+)"\s*$/i);
  if (!match) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  const extension = format === "CSV" ? "csv" : "xlsx";
  const expected = new RegExp(
    `^sentinel-${kind.toLowerCase()}-\\d{8}T\\d{6}Z\\.${extension}$`,
  );
  if (!expected.test(match[1])) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return match[1];
}

export async function exportDiscoveryResults(
  request: DiscoveryExportRequest,
  options?: RequestOptions,
): Promise<DiscoveryExportFile> {
  const response = await postBinary(
    "/api/v1/discovery/exports",
    request,
    { ...options, acceptedStatuses: [200] },
  );
  const mediaType = response.contentType?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== EXPORT_MEDIA_TYPES[request.format]) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return {
    blob: response.blob,
    filename: exportFilename(response.contentDisposition, request.format, request.search.kind),
    format: request.format,
  };
}

export async function createFeedbackEvent(
  params: FeedbackCreateParams,
  options?: RequestOptions,
): Promise<FeedbackCreateResponse> {
  const body: { action: FeedbackAction; source?: FeedbackSource | null } = { action: params.action };
  if (params.source !== undefined) body.source = params.source;
  const response = await postJson(
    `/api/v1/feedback/establishments/${encodeURIComponent(params.cnpjFull)}/events`,
    body,
    { ...options, headers: { "Idempotency-Key": params.idempotencyKey }, acceptedStatuses: [200, 201] },
  );
  if (!isFeedbackCreateResponse(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}

export async function listFeedbackEvents(
  params: FeedbackHistoryParams,
  options?: RequestOptions,
): Promise<FeedbackHistoryPage> {
  const query = paginationQuery(params.limit, params.offset);
  const response = await getJson(
    `/api/v1/feedback/establishments/${encodeURIComponent(params.cnpjFull)}/events?${query}`,
    options,
  );
  if (!isFeedbackHistoryPage(response)) {
    throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  }
  return response;
}
