import { isSessionResponse, type SessionResponse } from "../types/api";
import { getJson, postJson, SentinelApiError, type RequestOptions } from "./apiClient";

/** Contrato: sentinel docs/api/12-human-auth.md (#210/#213). */
export interface LoginCredentials {
  loginName: string;
  password: string;
}

function validSession(response: unknown): SessionResponse {
  if (!isSessionResponse(response)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return response;
}

export async function getSession(options: Pick<RequestOptions, "signal"> = {}): Promise<SessionResponse> {
  return validSession(await getJson("/api/v1/auth/session", { ...options, auth: "session" }));
}

export async function login(credentials: LoginCredentials, options: Pick<RequestOptions, "signal"> = {}): Promise<SessionResponse> {
  const response = await postJson(
    "/api/v1/auth/login",
    { login_name: credentials.loginName, password: credentials.password },
    { ...options, auth: "login", acceptedStatuses: [200] },
  );
  return validSession(response);
}

export async function logout(): Promise<void> {
  await postJson("/api/v1/auth/logout", {}, { auth: "logout", acceptedStatuses: [204] });
}
