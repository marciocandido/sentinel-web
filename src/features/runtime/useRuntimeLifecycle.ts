import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import { getRuntimeStatus } from "../../services/sentinelApi";
import type { RuntimeStatusResponse } from "../../types/api";
import type { RuntimeLifecycleView, RuntimeTransportState } from "./runtimeTypes";

const FAST_POLL_MS = 15_000;
const HEALTHY_POLL_MS = 60_000;
const STALE_AFTER_MS = 120_000;

function isStableHealthy(runtime: RuntimeStatusResponse) {
  const { components, base } = runtime;
  return runtime.summary === "AVAILABLE" && base.state === "READY" &&
    components.api.state === "AVAILABLE" && components.database.state === "AVAILABLE" &&
    components.database.schema_current === true && components.worker.state === "IDLE";
}

export function useRuntimeLifecycle(): RuntimeLifecycleView {
  const [runtime, setRuntime] = useState<RuntimeStatusResponse | null>(null);
  const [transportState, setTransportState] = useState<RuntimeTransportState>("pending");
  const [lastConfirmedAt, setLastConfirmedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const healthyRoundsRef = useRef(0);
  const lastConfirmedRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const updateStale = useCallback(() => {
    const confirmed = lastConfirmedRef.current;
    if (confirmed !== null && Date.now() - confirmed >= STALE_AFTER_MS) setTransportState("stale");
  }, []);

  const scheduleRef = useRef<(delay: number) => void>(() => undefined);
  const runRef = useRef<() => void>(() => undefined);

  const run = useCallback(() => {
    if (document.hidden || controllerRef.current) return;
    clearTimer();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestRef.current;
    setChecking(true);

    void getRuntimeStatus({ signal: controller.signal }).then((next) => {
      if (!mountedRef.current || requestId !== requestRef.current || controller.signal.aborted) return;
      const now = Date.now();
      lastConfirmedRef.current = now;
      setRuntime(next);
      setLastConfirmedAt(now);
      setLastErrorCode(null);
      setTransportState("fresh");
      healthyRoundsRef.current = isStableHealthy(next) ? healthyRoundsRef.current + 1 : 0;
    }).catch((error: unknown) => {
      if (!mountedRef.current || requestId !== requestRef.current || controller.signal.aborted) return;
      healthyRoundsRef.current = 0;
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      setLastErrorCode(code);
      const confirmed = lastConfirmedRef.current;
      setTransportState(confirmed !== null && Date.now() - confirmed >= STALE_AFTER_MS ? "stale" : "degraded");
    }).finally(() => {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      controllerRef.current = null;
      setChecking(false);
      if (document.hidden) return;
      const delay = healthyRoundsRef.current >= 2 ? HEALTHY_POLL_MS : FAST_POLL_MS;
      scheduleRef.current(delay);
    });
  }, [clearTimer]);

  const schedule = useCallback((delay: number) => {
    clearTimer();
    if (document.hidden) return;
    timerRef.current = window.setTimeout(() => {
      updateStale();
      runRef.current();
    }, delay);
  }, [clearTimer, updateStale]);

  useEffect(() => {
    runRef.current = run;
    scheduleRef.current = schedule;
  }, [run, schedule]);

  const refreshNow = useCallback(() => {
    clearTimer();
    updateStale();
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    runRef.current();
  }, [clearTimer, updateStale]);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.hidden) {
        clearTimer();
        requestRef.current += 1;
        controllerRef.current?.abort();
        controllerRef.current = null;
      } else {
        refreshNow();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    runRef.current();
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimer();
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [clearTimer, refreshNow]);

  return { runtime, transportState, lastConfirmedAt, checking, lastErrorCode, refreshNow };
}
