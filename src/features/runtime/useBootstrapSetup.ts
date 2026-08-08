import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import { getBootstrapPreflight, startBootstrap } from "../../services/sentinelApi";
import type { BootstrapPreflightResponse } from "../../types/api";

export type BootstrapStartResult =
  | "accepted"
  | "uncertain"
  | "blocked"
  | "failed";

export function useBootstrapSetup(active: boolean, refreshRuntime: () => void) {
  const [preflight, setPreflight] = useState<BootstrapPreflightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);

  const reload = useCallback(async (): Promise<boolean> => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const id = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const value = await getBootstrapPreflight(undefined, { signal: request.signal });
      if (id !== generation.current) return false;
      setPreflight(value);
      return true;
    } catch (cause) {
      if (id === generation.current && !request.signal.aborted) {
        setError(cause instanceof SentinelApiError ? cause.code : "network_error");
      }
      return false;
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) queueMicrotask(() => void reload());
    else {
      controller.current?.abort();
      queueMicrotask(() => {
        setPreflight(null);
        setAccepted(false);
        setUncertain(false);
        setError(null);
      });
    }
    return () => controller.current?.abort();
  }, [active, reload]);

  const verifyUncertain = useCallback(async () => {
    refreshRuntime();
    const valid = await reload();
    if (valid) setUncertain(false);
  }, [refreshRuntime, reload]);

  const start = useCallback(async (competence: string): Promise<BootstrapStartResult> => {
    if (starting.current) return "failed";
    starting.current = true;
    setLoading(true);
    setError(null);
    try {
      await startBootstrap(competence);
      setAccepted(true);
      refreshRuntime();
      return "accepted";
    } catch (cause) {
      const code = cause instanceof SentinelApiError ? cause.code : "network_error";
      if (code === "request_timeout" || code === "network_error") {
        setUncertain(true);
        setError("uncertain");
        refreshRuntime();
        return "uncertain";
      }
      setError(code);
      if (code === "bootstrap_blocked" || code === "bootstrap_conflict") {
        refreshRuntime();
        void reload();
        return "blocked";
      }
      return "failed";
    } finally {
      starting.current = false;
      setLoading(false);
    }
  }, [refreshRuntime, reload]);

  return { preflight, loading, error, accepted, uncertain, reload, verifyUncertain, start };
}
