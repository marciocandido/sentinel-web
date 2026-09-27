import type { AuthenticatedSessionResponse, SentinelPermission } from "../../types/api";

/**
 * Capabilities da sessão servem só para apresentação; a autoridade continua no
 * backend. Não há hierarquia: `sentinel:admin` não implica `a1:manage`.
 */
export function hasPermission(session: AuthenticatedSessionResponse, permission: SentinelPermission): boolean {
  return session.permissions.includes(permission);
}

export type LoginField = "login" | "password";

export interface AuthNotice {
  tone: "error" | "info";
  message: string;
  field: LoginField | null;
}

export type ForbiddenReason = "access_disabled" | "permission_denied";
export type UnavailableReason = "network" | "invalid_response" | "auth_unavailable";

export type AuthState =
  | { status: "checking" }
  | { status: "anonymous"; notice: AuthNotice | null }
  | { status: "authenticating" }
  | { status: "authenticated"; session: AuthenticatedSessionResponse }
  | { status: "forbidden"; reason: ForbiddenReason }
  | { status: "unavailable"; reason: UnavailableReason }
  | { status: "signing_out" };

export const SESSION_EXPIRED_NOTICE: AuthNotice = { tone: "info", message: "Sua sessão expirou. Entre novamente.", field: null };
export const SESSION_ENDED_NOTICE: AuthNotice = { tone: "info", message: "Sua sessão foi encerrada. Entre novamente.", field: null };
export const LOGOUT_UNCONFIRMED_NOTICE: AuthNotice = {
  tone: "error",
  message: "Não foi possível confirmar a saída no servidor. Recarregue a página antes de entrar novamente.",
  field: null,
};

const LOGIN_MESSAGES: Readonly<Record<string, AuthNotice>> = {
  invalid_credentials: { tone: "error", message: "Usuário ou senha inválidos.", field: "password" },
  invalid_request: { tone: "error", message: "Usuário ou senha inválidos.", field: "login" },
  access_disabled: { tone: "error", message: "Seu acesso ao Sentinel está desativado.", field: null },
  permission_denied: { tone: "error", message: "Sua conta não possui acesso ao Sentinel.", field: null },
  login_limited: { tone: "error", message: "Muitas tentativas de acesso. Tente novamente mais tarde.", field: null },
  auth_unavailable: { tone: "error", message: "O serviço de autenticação está temporariamente indisponível.", field: null },
  already_authenticated: { tone: "error", message: "Já existe uma sessão ativa neste navegador. Recarregue a página para continuar.", field: null },
  network_error: { tone: "error", message: "Não foi possível conectar ao Sentinel. Verifique a conexão e tente novamente.", field: null },
  request_timeout: { tone: "error", message: "O Sentinel demorou a responder. Tente novamente.", field: null },
};

const LOGIN_FALLBACK: AuthNotice = { tone: "error", message: "Não foi possível entrar agora. Tente novamente.", field: null };

/** Mensagem do backend nunca é exibida: somente códigos conhecidos, em português. */
export function loginFailureNotice(code: string): AuthNotice {
  return LOGIN_MESSAGES[code] ?? LOGIN_FALLBACK;
}

export const FORBIDDEN_MESSAGES: Readonly<Record<ForbiddenReason, string>> = {
  access_disabled: "Seu acesso ao Sentinel está desativado. Procure um administrador do Sentinel.",
  permission_denied: "Sua conta não possui acesso ao Sentinel. Procure um administrador do Sentinel.",
};

export const UNAVAILABLE_MESSAGES: Readonly<Record<UnavailableReason, string>> = {
  network: "Não foi possível conectar ao Sentinel. Verifique a conexão e tente novamente.",
  invalid_response: "O Sentinel retornou uma resposta inesperada ao verificar a sessão.",
  auth_unavailable: "O serviço de autenticação está temporariamente indisponível.",
};
