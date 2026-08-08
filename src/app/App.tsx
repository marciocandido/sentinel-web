import { BaseLifecycleGate } from "../features/runtime/BaseLifecycleGate";
import { useRuntimeLifecycle } from "../features/runtime/useRuntimeLifecycle";
import { AppShell } from "./AppShell";

export function App() {
  const runtime = useRuntimeLifecycle();
  return (
    <AppShell runtime={runtime}>
      <BaseLifecycleGate runtime={runtime} />
    </AppShell>
  );
}
