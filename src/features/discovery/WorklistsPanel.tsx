import { useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import {
  createWorklist,
  deleteWorklist,
  listWorklistItems,
  listWorklists,
  type DiscoverySearchSpec,
  type Worklist,
  type WorklistItemPage,
  type WorklistPage,
} from "../../services/sentinelApi";
import { publicWorklistError, worklistCreatedAt, worklistSearchKindLabel } from "./worklists";

const PAGE_SIZE = 20;

type ReadState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; page: T }
  | { kind: "error"; message: string };

function display(value: string | null): string {
  return value ?? "—";
}

export function WorklistsPanel({ search, generation, showList = true }: {
  search: DiscoverySearchSpec | null;
  generation: number;
  showList?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pendingSearch, setPendingSearch] = useState<DiscoverySearchSpec | null>(null);
  const [name, setName] = useState("");
  const [listState, setListState] = useState<ReadState<WorklistPage>>({ kind: "idle" });
  const [itemsState, setItemsState] = useState<ReadState<WorklistItemPage>>({ kind: "idle" });
  const [openedWorklist, setOpenedWorklist] = useState<Worklist | null>(null);
  const [confirm, setConfirm] = useState<Worklist | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const readControllerRef = useRef<AbortController | null>(null);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const readIdRef = useRef(0);
  const mutationIdRef = useRef(0);
  const mountedRef = useRef(false);
  const generationRef = useRef(generation);

  const loadWorklists = async (offset: number) => {
    readIdRef.current += 1;
    const requestId = readIdRef.current;
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;
    setListState({ kind: "loading" });
    try {
      const page = await listWorklists({ limit: PAGE_SIZE, offset }, { signal: controller.signal });
      if (!controller.signal.aborted && mountedRef.current && requestId === readIdRef.current) {
        setListState({ kind: "success", page });
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && mountedRef.current && requestId === readIdRef.current && code !== "request_aborted") {
        setListState({ kind: "error", message: publicWorklistError(code) });
      }
    } finally {
      if (requestId === readIdRef.current) readControllerRef.current = null;
    }
  };

  const loadItems = async (worklist: Worklist, offset: number) => {
    readIdRef.current += 1;
    const requestId = readIdRef.current;
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;
    setOpenedWorklist(worklist);
    setItemsState({ kind: "loading" });
    try {
      const page = await listWorklistItems(worklist.worklist_id, { limit: PAGE_SIZE, offset }, { signal: controller.signal });
      if (!controller.signal.aborted && mountedRef.current && requestId === readIdRef.current) {
        setItemsState({ kind: "success", page });
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && mountedRef.current && requestId === readIdRef.current && code !== "request_aborted") {
        setItemsState({ kind: "error", message: publicWorklistError(code) });
      }
    } finally {
      if (requestId === readIdRef.current) readControllerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      readIdRef.current += 1;
      mutationIdRef.current += 1;
      readControllerRef.current?.abort();
      mutationControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (generationRef.current === generation) return;
    generationRef.current = generation;
    mutationIdRef.current += 1;
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = null;
    setSaveOpen(false);
    setPendingSearch(null);
    setName("");
    setMutating(false);
    setMutationError(null);
  }, [generation]);

  const save = async () => {
    const trimmed = name.trim();
    if (!pendingSearch || !trimmed || trimmed.length > 120 || mutating) return;
    mutationIdRef.current += 1;
    const requestId = mutationIdRef.current;
    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    setMutating(true);
    setMutationError(null);
    try {
      await createWorklist({ name: trimmed, search: pendingSearch }, { signal: controller.signal });
      if (!controller.signal.aborted && mountedRef.current && requestId === mutationIdRef.current) {
        setSaveOpen(false);
        setPendingSearch(null);
        setName("");
        setNotice("Lista de trabalho salva.");
        if (showList && open) void loadWorklists(0);
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && mountedRef.current && requestId === mutationIdRef.current && code !== "request_aborted") {
        setMutationError(publicWorklistError(code));
      }
    } finally {
      if (!controller.signal.aborted && mountedRef.current && requestId === mutationIdRef.current) setMutating(false);
      if (requestId === mutationIdRef.current) mutationControllerRef.current = null;
    }
  };

  const remove = async () => {
    if (!confirm || mutating) return;
    const removed = confirm;
    mutationIdRef.current += 1;
    const requestId = mutationIdRef.current;
    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    setMutating(true);
    setMutationError(null);
    try {
      await deleteWorklist(removed.worklist_id, { signal: controller.signal });
      if (!controller.signal.aborted && mountedRef.current && requestId === mutationIdRef.current) {
        setConfirm(null);
        if (openedWorklist?.worklist_id === removed.worklist_id) {
          setOpenedWorklist(null);
          setItemsState({ kind: "idle" });
        }
        const page = listState.kind === "success" ? listState.page : null;
        const offset = page?.pagination.offset ?? 0;
        const nextOffset = page && page.items.length === 1 && offset > 0 ? Math.max(0, offset - PAGE_SIZE) : offset;
        void loadWorklists(nextOffset);
      }
    } catch (error) {
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (!controller.signal.aborted && mountedRef.current && requestId === mutationIdRef.current) {
        setConfirm(null);
        if (code !== "request_aborted") {
          setMutationError(publicWorklistError(code));
          void loadWorklists(listState.kind === "success" ? listState.page.pagination.offset : 0);
        }
      }
    } finally {
      if (!controller.signal.aborted && mountedRef.current && requestId === mutationIdRef.current) setMutating(false);
      if (requestId === mutationIdRef.current) mutationControllerRef.current = null;
    }
  };

  const listPage = listState.kind === "success" ? listState.page : null;
  const itemPage = itemsState.kind === "success" ? itemsState.page : null;

  return <section className="worklists" aria-label="Listas de trabalho">
    <div className="export-actions__buttons">
      {search && <button className="secondary-button" type="button" onClick={() => {
        setPendingSearch(search);
        setSaveOpen(true);
        setMutationError(null);
      }}>Salvar como lista de trabalho</button>}
      {showList && <button className="secondary-button" type="button" aria-expanded={open} onClick={() => {
        const next = !open;
        setOpen(next);
        if (next) void loadWorklists(0);
      }}>Listas de trabalho</button>}
    </div>
    {notice && <p aria-live="polite">{notice}</p>}
    {saveOpen && <div className="worklists__save">
      <label htmlFor="worklist-name">Nome da lista de trabalho</label>
      <input id="worklist-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      {mutationError && <p role="alert">{mutationError}</p>}
      <button type="button" onClick={() => void save()} disabled={mutating || !name.trim()}>Salvar</button>
      <button type="button" onClick={() => { setSaveOpen(false); setPendingSearch(null); setName(""); }} disabled={mutating}>Cancelar</button>
    </div>}
    {open && <div className="worklists__content">
      <h2>Listas de trabalho</h2>
      {listState.kind === "loading" && <p role="status">Carregando listas de trabalho...</p>}
      {listState.kind === "error" && <p role="alert">{listState.message}</p>}
      {mutationError && !saveOpen && <p role="alert">{mutationError}</p>}
      {listPage && !listPage.items.length && <p>Nenhuma lista de trabalho.</p>}
      {listPage && listPage.items.length > 0 && <ul className="worklists__list">{listPage.items.map((item) => <li key={item.worklist_id}>
        <strong>{item.name}</strong> — {worklistSearchKindLabel[item.source_search.kind]} · {item.item_count} membros
        {item.source_search.include_discarded === true && " · Inclui descartados"}
        <br /><small>{worklistCreatedAt(item.created_at)}</small><br />
        <button type="button" onClick={() => void loadItems(item, 0)}>Abrir</button>
        <button type="button" onClick={() => { setConfirm(item); setMutationError(null); }}>Excluir</button>
      </li>)}</ul>}
      {listPage && <div className="pagination">
        <p>Mostrando {listPage.pagination.returned} listas.</p>
        <div className="pagination-buttons">
          <button type="button" onClick={() => void loadWorklists(Math.max(0, listPage.pagination.offset - PAGE_SIZE))} disabled={listState.kind === "loading" || listPage.pagination.offset === 0}>Anterior</button>
          <button type="button" onClick={() => void loadWorklists(listPage.pagination.offset + PAGE_SIZE)} disabled={listState.kind === "loading" || !listPage.pagination.has_more}>Próxima</button>
        </div>
      </div>}
      {confirm && <div role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão da lista de trabalho">
        <p>Excluir “{confirm.name}”?</p>
        <button type="button" onClick={() => void remove()} disabled={mutating}>Confirmar exclusão</button>
        <button type="button" onClick={() => setConfirm(null)} disabled={mutating}>Cancelar</button>
      </div>}
      {openedWorklist && <section className="worklists__items" aria-labelledby="worklist-items-title">
        <h3 id="worklist-items-title">Membros: {openedWorklist.name}</h3>
        {itemsState.kind === "loading" && <p role="status">Carregando membros da lista...</p>}
        {itemsState.kind === "error" && <p role="alert">{itemsState.message}</p>}
        {itemPage && !itemPage.items.length && <p>Esta lista não possui membros.</p>}
        {itemPage && itemPage.items.length > 0 && <div className="table-scroll"><table className="results-table worklists__table">
          <caption>Membros da lista de trabalho</caption><thead><tr><th>CNPJ</th><th>Empresa</th><th>Município/UF</th><th>CNAE</th><th>Porte</th><th>Precisão geográfica</th></tr></thead>
          <tbody>{itemPage.items.map((item) => item.establishment_known && item.establishment ? <tr key={item.cnpj_full}>
            <td className="cell-code">{item.cnpj_full}</td><td>{display(item.establishment.razao_social)}<span className="cell-secondary">{display(item.establishment.nome_fantasia)}</span></td>
            <td>{display(item.establishment.municipio_nome)} / {display(item.establishment.uf)}</td><td className="cell-code">{display(item.establishment.cnae_principal)}</td><td className="cell-code">{display(item.establishment.porte_codigo)}</td><td>{display(item.establishment.location_precision)}</td>
          </tr> : <tr key={item.cnpj_full}><td className="cell-code">{item.cnpj_full}</td><td colSpan={5}>Não encontrado na base atual</td></tr>)}</tbody>
        </table></div>}
        {itemPage && <div className="pagination"><p>Mostrando {itemPage.pagination.returned} membros.</p><div className="pagination-buttons">
          <button type="button" onClick={() => void loadItems(openedWorklist, Math.max(0, itemPage.pagination.offset - PAGE_SIZE))} disabled={itemsState.kind === "loading" || itemPage.pagination.offset === 0}>Anterior</button>
          <button type="button" onClick={() => void loadItems(openedWorklist, itemPage.pagination.offset + PAGE_SIZE)} disabled={itemsState.kind === "loading" || !itemPage.pagination.has_more}>Próxima</button>
        </div></div>}
      </section>}
    </div>}
  </section>;
}
