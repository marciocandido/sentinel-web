import type { AdminCapability, AdminUser, AdminUserListResponse } from "../types/api";
import { TEST_USER_ID } from "./authFixtures";

export const OTHER_USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const INACTIVE_USER_ID = "16fd2706-8baf-433b-82eb-8c7fada847da";
export const CREATED_USER_ID = "9a1f7d2c-3b4e-4f5a-8b6c-7d8e9f0a1b2c";

/**
 * Catálogo sintético: labels deliberadamente distintos dos códigos e uma
 * capability extra, para provar que a UI usa o catálogo da API como autoridade.
 */
export const adminCatalog: AdminCapability[] = [
  { code: "sentinel:access", label: "Acesso ao Sentinel (catálogo)", description: "Descrição de acesso vinda da API.", domain: "sentinel" },
  { code: "sentinel:admin", label: "Administração do Sentinel (catálogo)", description: "Descrição de administração vinda da API.", domain: "sentinel" },
  { code: "a1:manage", label: "Gestão A1 (catálogo)", description: "Descrição A1 vinda da API.", domain: "a1" },
  { code: "reports:view", label: "Relatórios (catálogo)", description: "Capability futura publicada pelo backend.", domain: "reports" },
];

export function adminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    user_id: OTHER_USER_ID,
    login_name: "vendas.norte",
    display_name: "Equipe Vendas Norte",
    active: true,
    permissions: ["sentinel:access"],
    created_at: "2099-01-02T10:00:00Z",
    updated_at: "2099-01-03T11:30:00Z",
    ...overrides,
  };
}

export const selfAdminUser = (overrides: Partial<AdminUser> = {}) => adminUser({
  user_id: TEST_USER_ID,
  login_name: "operador",
  display_name: "Pessoa Operadora",
  permissions: ["sentinel:access", "sentinel:admin"],
  ...overrides,
});

export const inactiveUser = (overrides: Partial<AdminUser> = {}) => adminUser({
  user_id: INACTIVE_USER_ID,
  login_name: "antigo.usuario",
  display_name: "Usuário Antigo",
  active: false,
  ...overrides,
});

export function userPage(items: AdminUser[], overrides: Partial<AdminUserListResponse> = {}): AdminUserListResponse {
  return { items, limit: 25, offset: 0, has_more: false, ...overrides };
}
