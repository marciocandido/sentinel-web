import { DiscoveryLanding } from "../features/discovery/DiscoveryLanding";
import { useRuntimeLifecycle } from "../features/runtime/useRuntimeLifecycle";
import { AppShell } from "./AppShell";

export function App() {
  const runtime = useRuntimeLifecycle();
  return (
    <AppShell runtime={runtime}>
      <DiscoveryLanding />
    </AppShell>
  );
}
