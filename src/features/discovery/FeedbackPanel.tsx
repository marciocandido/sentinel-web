import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedbackAction, FeedbackHistoryPage } from "../../types/api";
import { SentinelApiError } from "../../services/apiClient";
import { createFeedbackEvent, listFeedbackEvents } from "../../services/sentinelApi";
import { FeedbackActions } from "./FeedbackActions";
import { FeedbackHistory } from "./FeedbackHistory";
import type { FeedbackAttempt, FeedbackPanelProps } from "./feedbackTypes";
import { feedbackPanelId, publicFeedbackError } from "./feedbackUtils";

const HISTORY_LIMIT = 20;

export function FeedbackPanel({ cnpjFull, companyName, source }: FeedbackPanelProps) {
  const [historyState, setHistoryState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [history, setHistory] = useState<FeedbackHistoryPage | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<FeedbackAttempt | null>(null);
  const [submissionState, setSubmissionState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const submissionRef = useRef(false);

  const loadHistory = useCallback(async (offset: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const request = ++requestRef.current;
    setHistoryState("loading");
    setHistoryError(null);
    try {
      const page = await listFeedbackEvents({ cnpjFull, limit: HISTORY_LIMIT, offset }, { signal: controller.signal });
      if (request !== requestRef.current || controller.signal.aborted) return;
      setHistory(page);
      setHistoryState("success");
    } catch (error) {
      if (request !== requestRef.current || controller.signal.aborted) return;
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (code !== "request_aborted") {
        setHistoryError(publicFeedbackError(code));
        setHistoryState("error");
      }
    }
  }, [cnpjFull]);

  useEffect(() => {
    const startRequest = window.setTimeout(() => void loadHistory(0), 0);
    return () => {
      window.clearTimeout(startRequest);
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [loadHistory]);

  const submit = async (nextAttempt: FeedbackAttempt) => {
    if (submissionRef.current) return;
    submissionRef.current = true;
    setAttempt(nextAttempt);
    setSubmissionState("submitting");
    setSubmissionError(null);
    try {
      await createFeedbackEvent({
        cnpjFull,
        action: nextAttempt.action,
        source,
        idempotencyKey: nextAttempt.idempotencyKey,
      });
      setAttempt(null);
      setSubmissionState("success");
      void loadHistory(0);
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      setSubmissionError(publicFeedbackError(code));
      setSubmissionState("error");
      if (code === "idempotency_conflict") setAttempt(null);
    } finally {
      submissionRef.current = false;
    }
  };

  const submitAction = (action: FeedbackAction) => {
    void submit({ action, idempotencyKey: `feedback-${crypto.randomUUID()}` });
  };

  const id = feedbackPanelId(cnpjFull);
  const offset = history?.pagination.offset ?? 0;
  const limit = history?.pagination.limit ?? HISTORY_LIMIT;
  return (
    <section id={id} className="feedback-panel" aria-label={`Feedback comercial de ${companyName}`}>
      <h3>Feedback comercial</h3>
      <p><strong>{companyName}</strong> · <span className="cell-code">{cnpjFull}</span></p>
      <p className="feedback-disclaimer">O feedback é um histórico append-only e não confirma ERP ou situação comercial.</p>
      <FeedbackActions disabled={submissionState === "submitting"} onAction={submitAction} />
      <div aria-live="polite" className="feedback-result">
        {submissionState === "submitting" && <p role="status">Registrando feedback…</p>}
        {submissionState === "success" && <p>Feedback registrado com sucesso.</p>}
      </div>
      {submissionState === "error" && <div role="alert" className="results-error"><p>{submissionError}</p>{attempt && <button type="button" className="secondary-button" onClick={() => void submit(attempt)}>Tentar novamente</button>}</div>}
      {historyState === "error" && <div role="alert" className="results-error"><p>{historyError}</p><button type="button" className="secondary-button" onClick={() => void loadHistory(offset)}>Tentar novamente</button></div>}
      <FeedbackHistory
        state={historyState}
        page={history}
        onPrevious={() => void loadHistory(Math.max(0, offset - limit))}
        onNext={() => {
          if (history?.pagination.has_more) void loadHistory(offset + limit);
        }}
      />
    </section>
  );
}
