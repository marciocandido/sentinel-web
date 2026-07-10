import {
  isLivenessResponse,
  isSegmentCatalogResponse,
  type LivenessResponse,
  type SegmentCatalogResponse,
} from "../types/api";
import { getJson, SentinelApiError, type RequestOptions } from "./apiClient";

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
