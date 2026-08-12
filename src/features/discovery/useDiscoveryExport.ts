import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import {
  exportDiscoveryResults,
  type DiscoveryExportFormat,
  type DiscoveryExportSearch,
} from "../../services/sentinelApi";
import { downloadDiscoveryExport } from "./discoveryExport";

export type DiscoveryExportState =
  | { kind: "idle" }
  | { kind: "loading"; format: DiscoveryExportFormat }
  | { kind: "success" }
  | { kind: "error"; code: string };

export function useDiscoveryExport() {
  const [state, setState] = useState<DiscoveryExportState>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ kind: "idle" });
  }, []);

  const start = useCallback(async (
    format: DiscoveryExportFormat,
    search: DiscoveryExportSearch,
  ) => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = requestIdRef.current;
    setState({ kind: "loading", format });
    try {
      const file = await exportDiscoveryResults(
        { format, search: { ...search } as DiscoveryExportSearch },
        { signal: controller.signal },
      );
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      downloadDiscoveryExport(file);
      setState({ kind: "success" });
    } catch (error) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (code === "request_aborted") setState({ kind: "idle" });
      else setState({ kind: "error", code });
    } finally {
      if (requestId === requestIdRef.current) controllerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  return { state, start, cancel };
}
