import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUpdatePreflight, startMonthlyUpdate } from "../../services/sentinelApi";
import { SentinelApiError } from "../../services/apiClient";
import type { UpdatePreflightResponse } from "../../types/api";
import type { RuntimeLifecycleView } from "./runtimeTypes";

type StartResult = "accepted" | "uncertain" | "blocked" | "failed" | "in_progress";
type UncertainAttempt = { target: string; confirmationVersion: number; baselineJobId: string | null };
const UNCERTAIN_CODES = new Set(["request_timeout", "network_error", "invalid_response", "invalid_json"]);

export function monthlyUpdateTarget(view: RuntimeLifecycleView) {
  const snapshot = view.runtime;
  if (!snapshot || snapshot.base.state !== "READY") return null;
  if (snapshot.base.available_competence) return snapshot.base.available_competence;
  return snapshot.update.status === "FAILED" || snapshot.update.status === "ROLLED_BACK"
    ? snapshot.update.target_competence
    : null;
}

export function useMonthlyUpdate(view: RuntimeLifecycleView) {
  const target = monthlyUpdateTarget(view);
  const terminalRetry = view.runtime?.update.status === "FAILED" || view.runtime?.update.status === "ROLLED_BACK";
  const activeUpdate = view.runtime?.update.status === "AUTHORIZED" || view.runtime?.update.status === "RUNNING";
  const shouldPreflight = view.transportState === "fresh" && Boolean(target) &&
    !activeUpdate && (Boolean(view.runtime?.base.available_competence) || terminalRetry);
  const [preflight, setPreflight] = useState<UpdatePreflightResponse | null>(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const preflightController = useRef<AbortController | null>(null);
  const postController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const uncertainAttempt = useRef<UncertainAttempt | null>(null);
  const reloadAfterRuntimeVersion = useRef<number | null>(null);

  const reload = useCallback(async () => {
    if (!target || view.transportState !== "fresh") return false;
    preflightController.current?.abort();
    const controller = new AbortController();
    preflightController.current = controller;
    const id = ++generation.current;
    setLoadingPreflight(true);
    setError(null);
    try {
      const next = await getUpdatePreflight(target, { signal: controller.signal });
      if (id !== generation.current || controller.signal.aborted) return false;
      setPreflight(next);
      return true;
    } catch (cause) {
      if (id === generation.current && !controller.signal.aborted) {
        setPreflight(null);
        setError(cause instanceof SentinelApiError ? cause.code : "network_error");
      }
      return false;
    } finally {
      if (id === generation.current) setLoadingPreflight(false);
    }
  }, [target, view.transportState]);

  useEffect(() => {
    preflightController.current?.abort();
    generation.current += 1;
    queueMicrotask(() => {
      setPreflight(null);
      setError(null);
      setAccepted(false);
      if (shouldPreflight && !uncertainAttempt.current) void reload();
    });
    return () => preflightController.current?.abort();
  }, [reload, shouldPreflight]);

  useEffect(() => () => postController.current?.abort(), []);

  useEffect(() => {
    const attempt = uncertainAttempt.current;
    if (!attempt || view.transportState !== "fresh" || view.confirmationVersion <= attempt.confirmationVersion) return;
    const update = view.runtime?.update;
    const isNewMatchingJob = update?.target_competence === attempt.target &&
      update.job_id !== null && update.job_id !== attempt.baselineJobId;
    if (isNewMatchingJob) {
      uncertainAttempt.current = null;
      queueMicrotask(() => {
        setUncertain(false);
        setAccepted(true);
        setError(null);
      });
      return;
    }
    const activeMatchingJob = update?.target_competence === attempt.target &&
      (update.status === "AUTHORIZED" || update.status === "RUNNING");
    if (activeMatchingJob) return;
    uncertainAttempt.current = null;
    queueMicrotask(() => {
      setUncertain(false);
      setAccepted(false);
      setError(null);
      void reload();
    });
  }, [reload, view.confirmationVersion, view.runtime, view.transportState]);

  useEffect(() => {
    const version = reloadAfterRuntimeVersion.current;
    if (version === null || view.confirmationVersion <= version || !shouldPreflight) return;
    reloadAfterRuntimeVersion.current = null;
    void reload();
  }, [reload, shouldPreflight, view.confirmationVersion]);

  const start = useCallback(async (): Promise<StartResult> => {
    const competence = preflight?.target_competence;
    if (!competence || !preflight.can_start || view.transportState !== "fresh") return "blocked";
    if (starting.current || uncertainAttempt.current) return "in_progress";
    starting.current = true;
    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const attempt: UncertainAttempt = {
      target: competence,
      confirmationVersion: view.confirmationVersion,
      baselineJobId: view.runtime?.update.job_id ?? null,
    };
    postController.current = controller;
    try {
      await startMonthlyUpdate(competence, { signal: controller.signal });
      setAccepted(true);
      setPreflight(null);
      view.refreshNow();
      return "accepted";
    } catch (cause) {
      if (controller.signal.aborted) return "failed";
      const code = cause instanceof SentinelApiError ? cause.code : "network_error";
      if (UNCERTAIN_CODES.has(code)) {
        uncertainAttempt.current = attempt;
        setUncertain(true);
        setPreflight(null);
        setError("uncertain");
        view.refreshNow();
        return "uncertain";
      }
      setPreflight(null);
      setError(code);
      if (code === "update_blocked" || code === "update_conflict") {
        reloadAfterRuntimeVersion.current = view.confirmationVersion;
        view.refreshNow();
        return "blocked";
      }
      return "failed";
    } finally {
      starting.current = false;
      postController.current = null;
      setSubmitting(false);
    }
  }, [preflight, view]);

  const verifyUncertain = useCallback(() => view.refreshNow(), [view]);
  return useMemo(() => ({ target, preflight, loadingPreflight, submitting, error, uncertain, accepted, reload, start, verifyUncertain }),
    [target, preflight, loadingPreflight, submitting, error, uncertain, accepted, reload, start, verifyUncertain]);
}
