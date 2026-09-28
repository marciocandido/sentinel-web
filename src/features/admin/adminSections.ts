import type { AuthenticatedSessionResponse, SentinelPermission } from "../../types/api";
import { hasPermission } from "../auth/authPresentation";

/**
 * Cada área da Administração declara a própria capability; o destino existe
 * quando ao menos uma área está disponível. Não há hierarquia entre
 * capabilities: `sentinel:admin` não implica `a1:manage`. A área de
 * certificado A1 (#60) entra aqui com `a1:manage`.
 */
export type AdminSectionId = "users";

export interface AdminSection {
  id: AdminSectionId;
  label: string;
  permission: SentinelPermission;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { id: "users", label: "Usuários", permission: "sentinel:admin" },
];

export function availableAdminSections(session: AuthenticatedSessionResponse): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => hasPermission(session, section.permission));
}
