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
