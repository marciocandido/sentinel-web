import { useState } from "react";
import type { Destination } from "../components/Sidebar";
import { AdministrationWorkspace } from "../features/admin/AdministrationWorkspace";
import { availableAdminSections } from "../features/admin/adminSections";
import { hasPermission } from "../features/auth/authPresentation";
import { BaseLifecycleGate } from "../features/runtime/BaseLifecycleGate";
import { useRuntimeLifecycle } from "../features/runtime/useRuntimeLifecycle";
import type { AuthenticatedSessionResponse } from "../types/api";
import { AppShell } from "./AppShell";

/**
 * Subtree protegido: só é montado com sessão confirmada pela AuthBoundary.
 * Navegação por estado local; Discovery permanece montado (oculto) para
 * preservar a pesquisa em andamento, e a Administração só é montada — e só
 * faz requests — quando aberta por quem tem alguma área administrativa.
 */
export function AuthenticatedApp({ session, onSignOut, onSessionRefresh = () => undefined }: {
  session: AuthenticatedSessionResponse;
  onSignOut: () => void;
  onSessionRefresh?: () => void;
}) {
  const runtime = useRuntimeLifecycle();
  const [requested, setRequested] = useState<Destination>("discovery");
  const adminSections = availableAdminSections(session);
  const available: Destination[] = adminSections.length ? ["discovery", "administration"] : ["discovery"];
  const destination = available.includes(requested) ? requested : "discovery";
  return (
    <AppShell runtime={runtime} identity={session.display_name} onSignOut={onSignOut} destination={destination} availableDestinations={available} onNavigate={setRequested}>
      <div className="workspace-view" hidden={destination !== "discovery"}>
        <BaseLifecycleGate runtime={runtime} canOperateBase={hasPermission(session, "sentinel:admin")} />
      </div>
      {destination === "administration" && <AdministrationWorkspace sections={adminSections} currentUserId={session.user_id} onSelfChanged={onSessionRefresh} />}
    </AppShell>
  );
}
