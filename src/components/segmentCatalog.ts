import { useCallback, useEffect, useState } from "react";
import { SentinelApiError } from "../services/apiClient";
import { listSegments } from "../services/sentinelApi";
import type { SegmentCatalogItem } from "../types/api";

export type SegmentCatalogState =
  | { kind: "loading" }
  | { kind: "ready"; items: SegmentCatalogItem[] }
  | { kind: "error"; code: string };

export interface SegmentCatalog {
  state: SegmentCatalogState;
  retry: () => void;
  /** Nome do catálogo para exibição; sem catálogo, devolve o próprio ID. */
  nameOf: (segmentId: string) => string;
}


/** Carrega o catálogo uma única vez para todos os seletores e resumos da tela. */
export function useSegmentCatalog(): SegmentCatalog {
  const [state, setState] = useState<SegmentCatalogState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    void listSegments({ signal: controller.signal })
      .then((response) => {
        if (mounted) setState({ kind: "ready", items: response.items });
      })
      .catch((error: unknown) => {
        if (!mounted || controller.signal.aborted) return;
        const code = error instanceof SentinelApiError ? error.code : "network_error";
        setState({ kind: "error", code });
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const nameOf = useCallback(
    (segmentId: string) =>
      (state.kind === "ready" && state.items.find((item) => item.id === segmentId)?.name) || segmentId,
    [state],
  );

  return { state, retry, nameOf };
}
