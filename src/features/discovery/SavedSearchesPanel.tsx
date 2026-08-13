import { useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  type DiscoverySearchSpec,
  type SavedSearch,
} from "../../services/sentinelApi";
import { savedSearchKindLabel, toEditableDiscoverySearch, type EditableDiscoverySearch } from "./savedSearches";

const PAGE_SIZE = 20;
function publicSavedSearchError(code: string): string {
  const messages: Record<string, string> = {
    invalid_request: "A API rejeitou os dados da pesquisa salva.",
    saved_search_not_found: "Esta pesquisa já não existe.",
    saved_search_name_conflict: "Já existe uma pesquisa com esse nome.",
    database_unavailable: "O banco do Sentinel está indisponível.",
    internal_server_error: "Não foi possível concluir a operação.",
    request_timeout: "A operação excedeu o tempo limite.",
    network_error: "Não foi possível conectar à API.",
    invalid_response: "A API retornou uma resposta inválida.",
  };
  return messages[code] ?? "Não foi possível concluir a operação.";
}

export function SavedSearchesPanel({ search, onLoad }: {
  search: DiscoverySearchSpec | null;
  onLoad: (editable: EditableDiscoverySearch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [name, setName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SavedSearch | null>(null);
  const readRef = useRef<AbortController | null>(null);
  const mutationRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);

  const load = async (nextOffset = offset) => {
    readRef.current?.abort();
    const controller = new AbortController();
    readRef.current = controller;
    setLoading(true); setError(null);
    try {
      const page = await listSavedSearches({ limit: PAGE_SIZE, offset: nextOffset }, { signal: controller.signal });
      if (!controller.signal.aborted && aliveRef.current) {
        setItems(page.items); setOffset(page.pagination.offset); setHasMore(page.pagination.has_more);
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && aliveRef.current && code !== "request_aborted") setError(publicSavedSearchError(code));
    } finally {
      if (!controller.signal.aborted && aliveRef.current) setLoading(false);
    }
  };

  useEffect(() => () => {
    aliveRef.current = false;
    readRef.current?.abort(); mutationRef.current?.abort();
  }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (!search || !trimmed || trimmed.length > 120 || mutating) return;
    mutationRef.current?.abort(); const controller = new AbortController(); mutationRef.current = controller;
    setMutating(true); setError(null);
    try {
      await createSavedSearch({ name: trimmed, search }, { signal: controller.signal });
      if (!controller.signal.aborted && aliveRef.current) {
        setName(""); setSaveOpen(false); setNotice("Pesquisa salva."); if (open) void load(0);
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && aliveRef.current && code !== "request_aborted") setError(publicSavedSearchError(code));
    } finally { if (!controller.signal.aborted && aliveRef.current) setMutating(false); }
  };

  const remove = async () => {
    if (!confirm || mutating) return;
    mutationRef.current?.abort(); const controller = new AbortController(); mutationRef.current = controller;
    const removed = confirm; setMutating(true); setError(null);
    try {
      await deleteSavedSearch(removed.saved_search_id, { signal: controller.signal });
      if (!controller.signal.aborted && aliveRef.current) {
        setConfirm(null); void load(items.length === 1 && offset > 0 ? Math.max(0, offset - PAGE_SIZE) : offset);
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && aliveRef.current) {
        setConfirm(null); if (code !== "request_aborted") setError(publicSavedSearchError(code)); void load(offset);
      }
    } finally { if (!controller.signal.aborted && aliveRef.current) setMutating(false); }
  };

  return <section className="saved-searches" aria-label="Pesquisas salvas">
    <div className="export-actions__buttons">
      {search && <button className="secondary-button" type="button" onClick={() => { setSaveOpen(true); setError(null); }}>Salvar pesquisa</button>}
      <button className="secondary-button" type="button" onClick={() => { const next = !open; setOpen(next); if (next) void load(0); }}>Pesquisas salvas</button>
    </div>
    {notice && <p aria-live="polite">{notice}</p>}
    {saveOpen && <div className="saved-searches__save">
      <label htmlFor="saved-search-name">Nome da pesquisa</label>
      <input id="saved-search-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      <button type="button" onClick={() => void save()} disabled={mutating || !name.trim()}>Salvar</button>
      <button type="button" onClick={() => setSaveOpen(false)} disabled={mutating}>Cancelar</button>
    </div>}
    {open && <div>
      <h2>Pesquisas salvas</h2>
      {loading && <p role="status">Carregando pesquisas salvas...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !items.length && !error && <p>Nenhuma pesquisa salva.</p>}
      <ul>{items.map((item) => {
        const editable = toEditableDiscoverySearch(item.search);
        return <li key={item.saved_search_id}><strong>{item.name}</strong> — {savedSearchKindLabel[item.search.kind]} {item.search.include_discarded === true && "(Inclui descartados)"}<br />
          <small>{new Date(item.created_at).toLocaleString()}</small>
          {editable ? <button type="button" onClick={() => onLoad(editable)}>Carregar</button> : <p>Esta definição não pode ser carregada nesta versão da interface.</p>}
          <button type="button" onClick={() => setConfirm(item)}>Excluir</button>
        </li>;
      })}</ul>
      <button type="button" onClick={() => void load(Math.max(0, offset - PAGE_SIZE))} disabled={loading || offset === 0}>Anterior</button>
      <button type="button" onClick={() => void load(offset + PAGE_SIZE)} disabled={loading || !hasMore}>Próxima</button>
      {confirm && <div role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão"><p>Excluir “{confirm.name}”?</p>
        <button type="button" onClick={() => void remove()} disabled={mutating}>Confirmar exclusão</button>
        <button type="button" onClick={() => setConfirm(null)} disabled={mutating}>Cancelar</button>
      </div>}
    </div>}
  </section>;
}
