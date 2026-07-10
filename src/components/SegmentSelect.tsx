import { useEffect, useState } from "react";
import { SentinelApiError } from "../services/apiClient";
import { listSegments } from "../services/sentinelApi";
import type { SegmentCatalogItem } from "../types/api";

type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; items: SegmentCatalogItem[] }
  | { kind: "error"; code: string };

function publicErrorMessage(code: string): string {
  if (code === "database_unavailable") {
    return "O catálogo não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível carregar os segmentos. Verifique a conexão com a API e tente novamente.";
}

export function SegmentSelect() {
  const [state, setState] = useState<CatalogState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState("");

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

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  };

  if (state.kind === "loading") {
    return <p className="field-message" role="status"><span className="mini-spinner" aria-hidden="true" />Carregando segmentos...</p>;
  }

  if (state.kind === "error") {
    return (
      <div className="field-error" role="alert">
        <p>{publicErrorMessage(state.code)}</p>
        <button className="secondary-button" type="button" onClick={retry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <>
        <select id="segment" name="segment" disabled value="" aria-describedby="segment-empty-message">
          <option>Selecione um segmento</option>
        </select>
        <p id="segment-empty-message" className="field-message">Nenhum segmento disponível.</p>
      </>
    );
  }

  return (
    <select
      id="segment"
      name="segment"
      value={selectedSegment}
      onChange={(event) => setSelectedSegment(event.target.value)}
    >
      <option value="">Selecione um segmento</option>
      {state.items.map((segment) => (
        <option key={segment.id} value={segment.id}>{segment.name}</option>
      ))}
    </select>
  );
}
