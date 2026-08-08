import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import { getBootstrapPreflight, startBootstrap } from "../../services/sentinelApi";
import type { BootstrapPreflightResponse } from "../../types/api";

export function useBootstrapSetup(active: boolean, refreshRuntime: () => void) {
  const [preflight, setPreflight] = useState<BootstrapPreflightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);

  const reload = useCallback(() => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const id = ++generation.current;
    setLoading(true);
    setError(null);
    void getBootstrapPreflight(undefined, { signal: request.signal })
      .then((value) => { if (id === generation.current) setPreflight(value); })
      .catch((cause) => {
        if (id === generation.current && !request.signal.aborted) {
          setError(cause instanceof SentinelApiError ? cause.code : "network_error");
        }
      })
      .finally(() => { if (id === generation.current) setLoading(false); });
  }, []);

  useEffect(() => {
    if (active) queueMicrotask(reload);
    else {
      controller.current?.abort();
      queueMicrotask(() => {
        setPreflight(null);
        setAccepted(false);
      });
    }
    return () => controller.current?.abort();
  }, [active, reload]);

  const start = useCallback(async (competence: string) => {
    if (starting.current) return false;
    starting.current = true;
    setLoading(true);
    setError(null);
    try {
      await startBootstrap(competence);
      setAccepted(true);
      refreshRuntime();
      return true;
    } catch (cause) {
      const code = cause instanceof SentinelApiError ? cause.code : "network_error";
      setError(code === "request_timeout" || code === "network_error" ? "uncertain" : code);
      if (code === "bootstrap_blocked" || code === "bootstrap_conflict") {
        refreshRuntime();
        reload();
      }
      return false;
    } finally {
      starting.current = false;
      setLoading(false);
    }
  }, [refreshRuntime, reload]);

  return { preflight, loading, error, accepted, reload, start };
}
