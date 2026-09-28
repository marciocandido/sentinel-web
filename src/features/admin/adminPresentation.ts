import { SentinelApiError } from "../../services/apiClient";
import type { AdminCapability } from "../../types/api";
import { ADMIN_SECTIONS } from "./adminSections";

/** Contrato #210: sem `sentinel:access` (ou com acesso desativado) todas as sessões da pessoa são revogadas. */
export const ACCESS_PERMISSION = "sentinel:access";
/** Mínimo vigente do backend para senha local (`CreateUserRequest`). */
export const PASSWORD_MIN_LENGTH = 12;
export const USERS_PAGE_SIZE = 25;

export const DEACTIVATION_NOTICE = "Desativar o acesso encerra as sessões existentes desse usuário.";

const ADMIN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  user_conflict: "Já existe um usuário com esse login.",
  user_not_found: "Usuário não encontrado. Atualize a lista.",
  permission_conflict: "A capability já estava concedida ou o usuário não existe mais. Os dados foram atualizados.",
  permission_not_found: "A capability já não estava concedida. Os dados foram atualizados.",
  unknown_capability: "O Sentinel não reconhece essa capability.",
  auth_data_invalid: "Os dados de autorização estão inconsistentes no servidor. Procure o suporte do Sentinel.",
  auth_unavailable: "O serviço de autenticação está temporariamente indisponível. Tente novamente.",
  permission_denied: "Sua conta não tem permissão para esta operação administrativa.",
  invalid_request: "O Sentinel não aceitou os dados enviados. Revise os campos e tente novamente.",
  csrf_invalid: "Não foi possível validar a segurança da operação. Recarregue a página e tente novamente.",
  invalid_response: "O Sentinel retornou uma resposta inesperada.",
  invalid_json: "O Sentinel retornou uma resposta inesperada.",
  network_error: "Não foi possível conectar ao Sentinel. Verifique a conexão e tente novamente.",
  request_timeout: "O Sentinel demorou a responder. Tente novamente.",
};

const ADMIN_ERROR_FALLBACK = "Não foi possível concluir a operação agora. Tente novamente.";

export function adminErrorCode(error: unknown): string {
  return error instanceof SentinelApiError ? error.code : "network_error";
}

/** Cancelamento (troca de página, logout, desmontagem) não é publicado como erro. */
export function isAborted(error: unknown): boolean {
  return adminErrorCode(error) === "request_aborted";
}

/** Mensagem do backend nunca é exibida: somente códigos conhecidos, em português. */
export function adminErrorMessage(error: unknown): string {
  return ADMIN_ERROR_MESSAGES[adminErrorCode(error)] ?? ADMIN_ERROR_FALLBACK;
}

export function formatAdminTimestamp(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** Label vem do catálogo do backend; sem entrada no catálogo, mostra-se o código recebido. */
export function capabilityLabel(code: string, catalog: readonly AdminCapability[] | null): string {
  return catalog?.find((capability) => capability.code === code)?.label ?? code;
}

/**
 * Consequência de uma alteração administrativa no próprio usuário: perder o
 * acesso encerra a sessão atual; perder a capability de uma área da
 * Administração remove essa área. A ação continua permitida.
 */
export type SelfImpact = "ends_session" | "loses_admin_area" | null;

export function selfRevokeImpact(permission: string): SelfImpact {
  if (permission === ACCESS_PERMISSION) return "ends_session";
  if (ADMIN_SECTIONS.some((section) => section.permission === permission)) return "loses_admin_area";
  return null;
}
