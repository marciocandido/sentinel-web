import type { AuthenticatedSessionResponse } from "../types/api";

export const TEST_USER_ID = "3f0c6a51-8f2e-4b7a-9c1d-2e5f6a7b8c9d";

/** Sessão sintética; o padrão espelha o primeiro administrador do bootstrap. */
export function authenticatedSession(overrides: Partial<AuthenticatedSessionResponse> = {}): AuthenticatedSessionResponse {
  return {
    authenticated: true,
    user_id: TEST_USER_ID,
    display_name: "Pessoa Operadora",
    active: true,
    permissions: ["sentinel:access", "sentinel:admin"],
    expires_at: "2099-01-01T12:00:00Z",
    ...overrides,
  };
}

export const anonymousSession = {
  authenticated: false,
  user_id: null,
  display_name: null,
  active: false,
  permissions: [],
  expires_at: null,
} as const;

export function setCsrfCookie(value: string | null, name = "sentinel_csrf"): void {
  document.cookie = value === null
    ? `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    : `${name}=${value}; path=/`;
}
