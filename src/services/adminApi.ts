import {
  isAdminCapabilityList,
  isAdminCreateUserResponse,
  isAdminUser,
  isAdminUserListResponse,
  isAdminUserPermissionsResponse,
  type AdminCapability,
  type AdminCreateUserResponse,
  type AdminUser,
  type AdminUserListResponse,
  type AdminUserPermissionsResponse,
} from "../types/api";
import { deleteNoContent, getJson, patchJson, postJson, SentinelApiError, type RequestOptions } from "./apiClient";

/**
 * Administração de usuários e capabilities — contrato: sentinel
 * docs/api/12-human-auth.md (#210/#213). Todas as rotas exigem
 * `sentinel:admin`; mutações recebem CSRF do `apiClient`.
 */
type AdminRequestOptions = Pick<RequestOptions, "signal">;

const USERS_PATH = "/api/v1/admin/users";

function validated<T>(payload: unknown, guard: (value: unknown) => value is T): T {
  if (!guard(payload)) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return payload;
}

function userPath(userId: string): string {
  return `${USERS_PATH}/${encodeURIComponent(userId)}`;
}

export interface CreateUserInput {
  loginName: string;
  displayName: string;
  password: string;
}

export async function listCapabilities(options: AdminRequestOptions = {}): Promise<AdminCapability[]> {
  return validated(await getJson("/api/v1/admin/capabilities", options), isAdminCapabilityList);
}

export async function listUsers(page: { limit: number; offset: number }, options: AdminRequestOptions = {}): Promise<AdminUserListResponse> {
  const query = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
  return validated(await getJson(`${USERS_PATH}?${query.toString()}`, options), isAdminUserListResponse);
}

export async function getUser(userId: string, options: AdminRequestOptions = {}): Promise<AdminUser> {
  return validated(await getJson(userPath(userId), options), isAdminUser);
}

export async function getUserPermissions(userId: string, options: AdminRequestOptions = {}): Promise<AdminUserPermissionsResponse> {
  const response = validated(await getJson(`${userPath(userId)}/permissions`, options), isAdminUserPermissionsResponse);
  if (response.user_id !== userId) throw new SentinelApiError("invalid_response", "Resposta inválida da API.");
  return response;
}

export async function createUser(input: CreateUserInput, options: AdminRequestOptions = {}): Promise<AdminCreateUserResponse> {
  const response = await postJson(
    USERS_PATH,
    { login_name: input.loginName, display_name: input.displayName, password: input.password },
    { ...options, acceptedStatuses: [201] },
  );
  return validated(response, isAdminCreateUserResponse);
}

export async function setUserAccess(userId: string, active: boolean, options: AdminRequestOptions = {}): Promise<void> {
  await patchJson(`${userPath(userId)}/access`, { active }, { ...options, acceptedStatuses: [204] });
}

export async function grantPermission(userId: string, permission: string, options: AdminRequestOptions = {}): Promise<void> {
  await postJson(`${userPath(userId)}/permissions`, { permission }, { ...options, acceptedStatuses: [204] });
}

export async function revokePermission(userId: string, permission: string, options: AdminRequestOptions = {}): Promise<void> {
  await deleteNoContent(`${userPath(userId)}/permissions/${encodeURIComponent(permission)}`, { ...options, acceptedStatuses: [204] });
}
