import { isApiErrorResponse } from "../types/api";
import { readCsrfToken } from "./csrf";

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

/**
 * Requests de autenticação (`authApi`) ficam fora do escopo protegido: não são
 * canceladas por `abortProtectedRequests` nem encerram a sessão ao falhar.
 * `login` é a única exceção de CSRF (`X-Sentinel-CSRF: login`); features não
 * informam CSRF.
 */
export type AuthRequestKind = "session" | "login" | "logout";

export interface RequestOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  auth?: AuthRequestKind;
}

export interface JsonRequestOptions extends RequestOptions {
  headers?: Record<string, string>;
  acceptedStatuses?: readonly number[];
}

export interface BinaryResponse {
  blob: Blob;
  contentType: string | null;
  contentDisposition: string | null;
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

function transportAbortError(
  error: unknown,
  timedOut: boolean,
  signal: AbortSignal,
): SentinelApiError | null {
  if (timedOut) {
    return new SentinelApiError("request_timeout", "A requisição excedeu o tempo limite.");
  }
  if (signal.aborted || isAbortError(error)) {
    return new SentinelApiError("request_aborted", "A requisição foi cancelada.");
  }
  return null;
}

const CSRF_HEADER = "X-Sentinel-CSRF";
const SESSION_ENDING_CODES: Readonly<Record<string, SessionEndReason>> = {
  not_authenticated: "unauthenticated",
  session_invalid: "unauthenticated",
  csrf_missing: "unauthenticated",
  session_expired: "expired",
  access_disabled: "access_disabled",
};

export type SessionEndReason = "unauthenticated" | "expired" | "access_disabled";

/**
 * Escopo das requests protegidas da sessão atual. Ao sair ou perder a sessão,
 * `abortProtectedRequests` cancela tudo o que ainda está pendente e abre um
 * novo escopo, de modo que respostas atrasadas de uma sessão não alcancem a
 * seguinte nem a encerrem.
 */
let protectedScope = new AbortController();
const sessionEndListeners = new Set<(reason: SessionEndReason) => void>();

export function abortProtectedRequests(): void {
  protectedScope.abort();
  protectedScope = new AbortController();
}

export function subscribeSessionEnd(listener: (reason: SessionEndReason) => void): () => void {
  sessionEndListeners.add(listener);
  return () => { sessionEndListeners.delete(listener); };
}

interface ActiveRequest {
  signal: AbortSignal;
  timedOut: () => boolean;
  finish: () => void;
}

function openRequest(options: RequestOptions): ActiveRequest {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  const sources = [options.signal, options.auth ? undefined : protectedScope.signal]
    .filter((source): source is AbortSignal => source !== undefined);
  for (const source of sources) {
    if (source.aborted) controller.abort();
    else source.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    finish: () => {
      window.clearTimeout(timeout);
      for (const source of sources) source.removeEventListener("abort", forwardAbort);
    },
  };
}

function notifySessionEnd(options: RequestOptions, error: SentinelApiError): void {
  if (options.auth) return;
  const reason = SESSION_ENDING_CODES[error.code];
  if (!reason) return;
  const expectedStatus = error.code === "access_disabled" ? 403 : error.code === "csrf_missing" ? null : 401;
  if (error.status !== expectedStatus) return;
  for (const listener of [...sessionEndListeners]) listener(reason);
}

function responseError(options: RequestOptions, payload: unknown, status: number, signal: AbortSignal): SentinelApiError {
  const error = isApiErrorResponse(payload)
    ? new SentinelApiError(payload.error.code, payload.error.message, status)
    : new SentinelApiError("http_error", "A API retornou um erro inesperado.", status);
  // Resposta de um escopo já encerrado (logout/troca de sessão) não afeta a sessão atual.
  if (!signal.aborted) notifySessionEnd(options, error);
  return error;
}

function transportError(error: unknown, request: ActiveRequest): SentinelApiError {
  return transportAbortError(error, request.timedOut(), request.signal)
    ?? new SentinelApiError("network_error", "Não foi possível conectar à API.");
}

/** Mutação recebe o CSRF vigente do cookie; o valor vindo da feature é descartado. */
function mutationHeaders(options: JsonRequestOptions, base: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...base };
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (name.toLowerCase() !== CSRF_HEADER.toLowerCase()) headers[name] = value;
  }
  if (options.auth === "login") {
    headers[CSRF_HEADER] = "login";
    return headers;
  }
  const token = readCsrfToken();
  if (!token) {
    const error = new SentinelApiError("csrf_missing", "Sessão sem token CSRF.");
    notifySessionEnd(options, error);
    throw error;
  }
  headers[CSRF_HEADER] = token;
  return headers;
}

function apiUrl(path: string, options: RequestOptions): string {
  return buildApiUrl(path, options.baseUrl ?? import.meta.env.VITE_SENTINEL_API_URL);
}

async function readJson(response: Response, request: ActiveRequest): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    const abortError = transportAbortError(error, request.timedOut(), request.signal);
    if (abortError) throw abortError;
    throw new SentinelApiError(
      "invalid_json",
      "A API retornou uma resposta que não pôde ser interpretada.",
      response.status,
    );
  }
}

export async function getJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const request = openRequest(options);
  try {
    let response: Response;
    try {
      response = await fetch(apiUrl(path, options), {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal: request.signal,
      });
    } catch (error) {
      throw transportError(error, request);
    }
    const payload = await readJson(response, request);
    if (!response.ok) throw responseError(options, payload, response.status, request.signal);
    return payload;
  } finally {
    request.finish();
  }
}

export async function postJson(
  path: string,
  body: unknown,
  options: JsonRequestOptions = {},
): Promise<unknown> {
  const headers = mutationHeaders(options, { Accept: "application/json", "Content-Type": "application/json" });
  const request = openRequest(options);
  try {
    let response: Response;
    try {
      response = await fetch(apiUrl(path, options), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "same-origin",
        signal: request.signal,
      });
    } catch (error) {
      throw transportError(error, request);
    }
    const acceptedStatuses = options.acceptedStatuses ?? [200, 201];
    if (response.status === 204 && acceptedStatuses.includes(204)) return null;
    const payload = await readJson(response, request);
    if (!acceptedStatuses.includes(response.status)) throw responseError(options, payload, response.status, request.signal);
    return payload;
  } finally {
    request.finish();
  }
}

export async function postBinary(
  path: string,
  body: unknown,
  options: JsonRequestOptions = {},
): Promise<BinaryResponse> {
  const headers = mutationHeaders(options, { Accept: "application/octet-stream", "Content-Type": "application/json" });
  const request = openRequest(options);
  try {
    let response: Response;
    try {
      response = await fetch(apiUrl(path, options), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "same-origin",
        signal: request.signal,
      });
    } catch (error) {
      throw transportError(error, request);
    }

    const acceptedStatuses = options.acceptedStatuses ?? [200];
    if (!acceptedStatuses.includes(response.status)) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        const abortError = transportAbortError(error, request.timedOut(), request.signal);
        if (abortError) throw abortError;
        payload = null;
      }
      throw responseError(options, payload, response.status, request.signal);
    }

    let blob: Blob;
    try {
      blob = await response.blob();
    } catch (error) {
      const abortError = transportAbortError(error, request.timedOut(), request.signal);
      if (abortError) throw abortError;
      throw new SentinelApiError(
        "invalid_response",
        "A API retornou uma resposta que não pôde ser interpretada.",
        response.status,
      );
    }
    return {
      blob,
      contentType: response.headers.get("Content-Type"),
      contentDisposition: response.headers.get("Content-Disposition"),
    };
  } finally {
    request.finish();
  }
}

export async function deleteNoContent(path: string, options: JsonRequestOptions = {}): Promise<void> {
  const headers = mutationHeaders(options, { Accept: "application/json" });
  const request = openRequest(options);
  try {
    let response: Response;
    try {
      response = await fetch(apiUrl(path, options), {
        method: "DELETE", headers, credentials: "same-origin", signal: request.signal,
      });
    } catch (error) {
      throw transportError(error, request);
    }
    const acceptedStatuses = options.acceptedStatuses ?? [204];
    if (acceptedStatuses.includes(response.status)) return;
    let payload: unknown = null;
    try { payload = await response.json(); } catch (error) {
      const abortError = transportAbortError(error, request.timedOut(), request.signal);
      if (abortError) throw abortError;
    }
    throw responseError(options, payload, response.status, request.signal);
  } finally {
    request.finish();
  }
}
