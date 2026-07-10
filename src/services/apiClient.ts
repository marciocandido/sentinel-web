import { isApiErrorResponse } from "../types/api";

export const DEFAULT_TIMEOUT_MS = 8_000;

export class SentinelApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "SentinelApiError";
  }
}

export interface RequestOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function normalizeBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim() ?? "";
  if (!trimmed) return "";

  const protocol = trimmed.match(/^(https?:\/\/)(.*)$/i);
  if (protocol) return `${protocol[1]}${protocol[2].replace(/\/+$/, "")}`;

  return trimmed.replace(/\/+$/, "");
}

export function buildApiUrl(path: string, baseUrl?: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return normalizedBaseUrl ? `${normalizedBaseUrl}${normalizedPath}` : normalizedPath;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function getJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;

  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(buildApiUrl(path, options.baseUrl ?? import.meta.env.VITE_SENTINEL_API_URL), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new SentinelApiError("request_timeout", "A requisição excedeu o tempo limite.");
      }
      if (isAbortError(error)) {
        throw new SentinelApiError("request_aborted", "A requisição foi cancelada.");
      }
      throw new SentinelApiError("network_error", "Não foi possível conectar à API.");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SentinelApiError(
        "invalid_json",
        "A API retornou uma resposta que não pôde ser interpretada.",
        response.status,
      );
    }

    if (!response.ok) {
      if (isApiErrorResponse(payload)) {
        throw new SentinelApiError(payload.error.code, payload.error.message, response.status);
      }
      throw new SentinelApiError("http_error", "A API retornou um erro inesperado.", response.status);
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}
