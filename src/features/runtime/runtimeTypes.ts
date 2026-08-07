import type { RuntimeStatusResponse } from "../../types/api";

export type RuntimeTransportState = "pending" | "fresh" | "degraded" | "stale";

export interface RuntimeLifecycleView {
  runtime: RuntimeStatusResponse | null;
  transportState: RuntimeTransportState;
  lastConfirmedAt: number | null;
  checking: boolean;
  lastErrorCode: string | null;
  refreshNow: () => void;
}
