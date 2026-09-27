import { hasPermission } from "../features/auth/authPresentation";
import { BaseLifecycleGate } from "../features/runtime/BaseLifecycleGate";
import { useRuntimeLifecycle } from "../features/runtime/useRuntimeLifecycle";
import type { AuthenticatedSessionResponse } from "../types/api";
import { AppShell } from "./AppShell";

/** Subtree protegido: só é montado com sessão confirmada pela AuthBoundary. */
export function AuthenticatedApp({ session, onSignOut }: { session: AuthenticatedSessionResponse; onSignOut: () => void }) {
  const runtime = useRuntimeLifecycle();
  return (
    <AppShell runtime={runtime} identity={session.display_name} onSignOut={onSignOut}>
      <BaseLifecycleGate runtime={runtime} canOperateBase={hasPermission(session, "sentinel:admin")} />
    </AppShell>
  );
}
