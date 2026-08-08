import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import { getBootstrapPreflight, startBootstrap } from "../../services/sentinelApi";
import type { BootstrapPreflightResponse } from "../../types/api";

export type BootstrapSetupState = "AWAITING_OPERATOR" | "FAILED" | null;
export type BootstrapStartResult = "accepted" | "uncertain" | "blocked" | "failed" | "in_progress";

export function useBootstrapSetup(state: BootstrapSetupState, confirmationVersion: number, refreshRuntime: () => void) {
  const [preflight, setPreflight] = useState<BootstrapPreflightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const uncertainVersion = useRef<number | null>(null);
  const reload = useCallback(async () => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    const id = ++generation.current; setPreflight(null); setLoading(true); setError(null);
    try { const value = await getBootstrapPreflight(undefined, { signal: request.signal }); if (id !== generation.current) return false; setPreflight(value); return true; }
    catch (cause) { if (id === generation.current && !request.signal.aborted) setError(cause instanceof SentinelApiError ? cause.code : "network_error"); return false; }
    finally { if (id === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { controller.current?.abort(); generation.current += 1; queueMicrotask(() => { setPreflight(null); setAccepted(false); setUncertain(false); setError(null); if (state) void reload(); }); return () => controller.current?.abort(); }, [state, reload]);
  useEffect(() => { if (!uncertain || uncertainVersion.current === null || confirmationVersion <= uncertainVersion.current || !state) return; void reload().then((valid) => { if (valid) setUncertain(false); }); }, [confirmationVersion, uncertain, state, reload]);
  const verifyUncertain = useCallback(() => { refreshRuntime(); }, [refreshRuntime]);
  const start = useCallback(async (competence: string): Promise<BootstrapStartResult> => {
    if (starting.current) return "in_progress"; starting.current = true; setLoading(true); setError(null);
    try { await startBootstrap(competence); setAccepted(true); refreshRuntime(); return "accepted"; }
    catch (cause) { const code = cause instanceof SentinelApiError ? cause.code : "network_error";
      if (["request_timeout", "network_error", "invalid_response", "invalid_json"].includes(code)) { uncertainVersion.current = confirmationVersion; setUncertain(true); setPreflight(null); setError("uncertain"); refreshRuntime(); return "uncertain"; }
      setPreflight(null); setError(code); if (code === "bootstrap_blocked" || code === "bootstrap_conflict") { refreshRuntime(); return "blocked"; } return "failed";
    } finally { starting.current = false; setLoading(false); }
  }, [confirmationVersion, refreshRuntime]);
  return { preflight, loading, error, accepted, uncertain, reload, verifyUncertain, start };
}
