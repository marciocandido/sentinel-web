import { Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import { deleteSavedSearch, listSavedSearches, type SavedSearch } from "../../services/sentinelApi";
import { describeSearch, type SegmentNameLookup } from "./discoveryQuery";
import { publicSavedSearchError, savedSearchKindLabel, toEditableDiscoverySearch, type EditableDiscoverySearch } from "./savedSearches";

const PAGE_SIZE = 20;
const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function savedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

interface SavedSearchesDrawerProps {
  onClose: () => void;
  /** Preenche o editor; nunca executa a busca. */
  onLoad: (editable: EditableDiscoverySearch, item: SavedSearch) => void;
  returnFocusTo: HTMLElement | null;
  segmentName: SegmentNameLookup;
}

/**
 * Painel lateral de pesquisas salvas. Autorizado pela #51 apenas para este
 * painel: foco contido, Escape, exterior inerte e retorno de foco.
 */
export function SavedSearchesDrawer({ onClose, onLoad, returnFocusTo, segmentName }: SavedSearchesDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const [returnFocusTarget] = useState(returnFocusTo);
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SavedSearch | null>(null);
  const [mutating, setMutating] = useState(false);
  const readRef = useRef<AbortController | null>(null);
  const mutationRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);

  const load = useCallback(async (nextOffset: number, clearError = true) => {
    readRef.current?.abort();
    const controller = new AbortController();
    readRef.current = controller;
    setLoading(true);
    if (clearError) setError(null);
    try {
      const page = await listSavedSearches({ limit: PAGE_SIZE, offset: nextOffset }, { signal: controller.signal });
      if (!controller.signal.aborted && aliveRef.current) {
        setItems(page.items);
        setOffset(page.pagination.offset);
        setHasMore(page.pagination.has_more);
      }
    } catch (caught) {
      const code = caught instanceof SentinelApiError ? caught.code : "network_error";
      if (!controller.signal.aborted && aliveRef.current && code !== "request_aborted") setError(publicSavedSearchError(code));
    } finally {
      if (!controller.signal.aborted && aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    queueMicrotask(() => { if (aliveRef.current) void load(0); });
    return () => {
      aliveRef.current = false;
      readRef.current?.abort();
      mutationRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [onClose, returnFocusTarget]);

  useEffect(() => {
    if (confirm) cancelDeleteRef.current?.focus();
  }, [confirm]);

  const remove = async () => {
    if (!confirm || mutating) return;
    mutationRef.current?.abort();
    const controller = new AbortController();
    mutationRef.current = controller;
    const removed = confirm;
    setMutating(true);
    setError(null);
    try {
      await deleteSavedSearch(removed.saved_search_id, { signal: controller.signal });
      if (!controller.signal.aborted && aliveRef.current) {
        setConfirm(null);
        void load(items.length === 1 && offset > 0 ? Math.max(0, offset - PAGE_SIZE) : offset);
        closeRef.current?.focus();
      }
    } catch (caught) {
      const code = caught instanceof SentinelApiError ? caught.code : "network_error";
      if (!controller.signal.aborted && aliveRef.current) {
        setConfirm(null);
        if (code !== "request_aborted") setError(publicSavedSearchError(code));
        void load(offset, false);
      }
    } finally {
      if (!controller.signal.aborted && aliveRef.current) setMutating(false);
    }
  };

  return (
    <div className="side-panel-layer">
      <div className="details-overlay" aria-hidden="true" onClick={onClose} />
      <aside
        ref={dialogRef}
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-searches-title"
        aria-describedby="saved-searches-description"
        id="saved-searches-panel"
      >
        <header className="side-panel__header">
          <div>
            <h2 id="saved-searches-title">Pesquisas salvas</h2>
            <p id="saved-searches-description">
              Guardam só os critérios. Carregar preenche o formulário; os resultados aparecem quando você clicar em Buscar.
            </p>
          </div>
          <button ref={closeRef} className="details-close" type="button" aria-label="Fechar pesquisas salvas" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="side-panel__content" aria-busy={loading}>
          {loading && <p className="loading-state" role="status"><span className="mini-spinner" aria-hidden="true" />Carregando pesquisas salvas...</p>}
          {error && <p className="results-error" role="alert">{error}</p>}
          {!loading && !items.length && !error && <p className="empty-state">Nenhuma pesquisa salva.</p>}
          <ul className="saved-list">
            {items.map((item) => {
              const editable = toEditableDiscoverySearch(item.search);
              const summary = describeSearch(item.search, segmentName).map((entry) => `${entry.label} ${entry.value}`);
              if (item.search.include_discarded === true) summary.push("inclui descartados");
              const confirming = confirm?.saved_search_id === item.saved_search_id;
              const titleId = `saved-${item.saved_search_id}`;
              return (
                <li key={item.saved_search_id} className="saved-item" aria-labelledby={titleId}>
                  <div className="saved-item__heading">
                    <h3 id={titleId}>{item.name}</h3>
                    <span className="kind-badge">{savedSearchKindLabel[item.search.kind]}</span>
                  </div>
                  <p className="saved-item__summary">{summary.join(" · ") || "Sem critérios adicionais"}</p>
                  <p className="saved-item__date">Salva em {savedAt(item.created_at)}</p>
                  {confirming ? (
                    <div className="confirm-box" role="group" aria-labelledby={`${titleId}-confirm`}>
                      <p id={`${titleId}-confirm`}>
                        <strong>Excluir “{item.name}”?</strong> A pesquisa sai desta lista. Listas de trabalho já criadas não são afetadas.
                      </p>
                      <div className="confirm-box__actions">
                        <button ref={cancelDeleteRef} className="secondary-button" type="button" disabled={mutating} onClick={() => setConfirm(null)}>Cancelar</button>
                        <button className="danger-button" type="button" disabled={mutating} onClick={() => void remove()}>
                          {mutating ? "Excluindo..." : "Excluir pesquisa"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="saved-item__actions">
                      {editable ? (
                        <button className="secondary-button" type="button" aria-label={`Carregar critérios de ${item.name}`} onClick={() => onLoad(editable, item)}>
                          Carregar critérios
                        </button>
                      ) : (
                        <p className="saved-item__note">Não pode ser carregada como busca principal nesta versão.</p>
                      )}
                      <button className="link-danger" type="button" aria-label={`Excluir ${item.name}`} onClick={() => setConfirm(item)}>
                        <Trash2 aria-hidden="true" size={14} /> Excluir
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {(offset > 0 || hasMore) && (
            <div className="pagination-buttons side-panel__pagination">
              <button className="secondary-button" type="button" onClick={() => void load(Math.max(0, offset - PAGE_SIZE))} disabled={loading || offset === 0}>Anterior</button>
              <button className="secondary-button" type="button" onClick={() => void load(offset + PAGE_SIZE)} disabled={loading || !hasMore}>Próxima</button>
            </div>
          )}
        </div>
        <footer className="side-panel__footer">
          Para guardar empresas encontradas, crie uma lista de trabalho a partir dos resultados.
        </footer>
      </aside>
    </div>
  );
}
