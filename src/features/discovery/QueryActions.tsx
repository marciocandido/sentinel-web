import { Bookmark, Download, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SentinelApiError } from "../../services/apiClient";
import {
  createSavedSearch,
  createWorklist,
  type DiscoveryExportFormat,
  type DiscoverySearchSpec,
} from "../../services/sentinelApi";
import { publicDiscoveryExportError } from "./discoveryExport";
import { publicSavedSearchError } from "./savedSearches";
import type { DiscoveryExportState } from "./useDiscoveryExport";
import { publicWorklistError } from "./worklists";

type Creation = "saved-search" | "worklist";

interface QueryActionsProps {
  /** Definição da consulta submetida; nunca derivada do formulário atual. */
  search: DiscoverySearchSpec;
  exportState: DiscoveryExportState;
  onExport: (format: DiscoveryExportFormat, search: DiscoverySearchSpec) => void;
}

const CREATION_COPY: Record<Creation, { label: string; field: string; success: string }> = {
  "saved-search": { label: "Salvar pesquisa", field: "Nome da pesquisa", success: "Pesquisa salva." },
  worklist: { label: "Criar lista de trabalho", field: "Nome da lista de trabalho", success: "Lista de trabalho salva." },
};

/**
 * O pai remonta este componente a cada nova submissão (`key`), descartando
 * tentativas abertas ou pendentes que pertenciam à consulta anterior.
 */
export function QueryActions({ search, exportState, onExport }: QueryActionsProps) {
  const [creation, setCreation] = useState<Creation | null>(null);
  const [pendingSearch, setPendingSearch] = useState<DiscoverySearchSpec | null>(null);
  const [name, setName] = useState("");
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (creation) nameRef.current?.focus();
  }, [creation]);

  const open = (next: Creation) => {
    setCreation(next);
    // A definição é capturada no clique: o formulário atual não participa.
    setPendingSearch(search);
    setName("");
    setError(null);
    setNotice(null);
  };

  const cancel = () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    setCreation(null);
    setPendingSearch(null);
    setName("");
    setMutating(false);
    setError(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!creation || !pendingSearch || !trimmed || trimmed.length > 120 || mutating) return;
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setMutating(true);
    setError(null);
    try {
      if (creation === "saved-search") {
        await createSavedSearch({ name: trimmed, search: pendingSearch }, { signal: controller.signal });
      } else {
        await createWorklist({ name: trimmed, search: pendingSearch }, { signal: controller.signal });
      }
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setNotice(CREATION_COPY[creation].success);
      setCreation(null);
      setPendingSearch(null);
      setName("");
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestIdRef.current || controller.signal.aborted) return;
      const code = caught instanceof SentinelApiError ? caught.code : "network_error";
      if (code !== "request_aborted") {
        setError(creation === "saved-search" ? publicSavedSearchError(code) : publicWorklistError(code));
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setMutating(false);
    }
  };

  const exporting = exportState.kind === "loading";
  return (
    <div className="query-actions">
      <div className="query-actions__buttons" role="group" aria-label="Ações da consulta submetida" aria-describedby="query-actions-help">
        <span className="query-actions__label" aria-hidden="true">Exportar</span>
        <button className="secondary-button" type="button" disabled={exporting} aria-busy={exporting || undefined} aria-label="Exportar CSV" onClick={() => onExport("CSV", search)}>
          <Download aria-hidden="true" size={15} /> CSV
        </button>
        <button className="secondary-button" type="button" disabled={exporting} aria-label="Exportar Excel" onClick={() => onExport("XLSX", search)}>
          <Download aria-hidden="true" size={15} /> Excel
        </button>
        <button className="secondary-button" type="button" aria-expanded={creation === "saved-search"} onClick={() => open("saved-search")}>
          <Bookmark aria-hidden="true" size={15} /> Salvar pesquisa
        </button>
        <button className="secondary-button" type="button" aria-expanded={creation === "worklist"} onClick={() => open("worklist")}>
          <Plus aria-hidden="true" size={15} /> Criar lista de trabalho
        </button>
      </div>
      <p id="query-actions-help" className="query-actions__help">
        Ações usam a consulta submetida completa — não o formulário atual nem só esta página.
      </p>
      {exportState.kind === "loading" && (
        <p className="query-actions__status" role="status">Preparando arquivo {exportState.format === "CSV" ? "CSV" : "Excel"}...</p>
      )}
      {exportState.kind === "success" && <p className="query-actions__status query-actions__status--success" aria-live="polite">Arquivo preparado para download.</p>}
      {exportState.kind === "error" && <p className="query-actions__status query-actions__status--error" role="alert">{publicDiscoveryExportError(exportState.code)}</p>}
      {notice && <p className="query-actions__status query-actions__status--success" aria-live="polite">{notice}</p>}
      {creation && (
        <form className="query-actions__create" onSubmit={save} aria-label={CREATION_COPY[creation].label}>
          <label htmlFor="query-action-name">{CREATION_COPY[creation].field}</label>
          <input
            id="query-action-name"
            ref={nameRef}
            value={name}
            maxLength={120}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "query-action-error" : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="primary-button primary-button--compact" type="submit" disabled={mutating || !name.trim()}>
            {mutating ? "Salvando..." : "Salvar"}
          </button>
          <button className="secondary-button" type="button" onClick={cancel}>Cancelar</button>
          {error && <p id="query-action-error" className="validation-message" role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
