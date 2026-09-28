import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { listCapabilities, listUsers } from "../../services/adminApi";
import type { AdminCapability, AdminUser, AdminUserListResponse } from "../../types/api";
import { adminErrorMessage, capabilityLabel, formatAdminTimestamp, isAborted, USERS_PAGE_SIZE } from "./adminPresentation";
import { UserCreateForm } from "./UserCreateForm";
import { AccessBadge, UserDetailPanel } from "./UserDetailPanel";

type ListState =
  | { status: "loading"; previous: AdminUserListResponse | null }
  | { status: "ready"; page: AdminUserListResponse }
  | { status: "error"; message: string };

/**
 * Área Usuários (`sentinel:admin`): lista paginada por `limit/offset/has_more`
 * na ordem da API, criação, acesso e capabilities. Nenhum total é inferido.
 */
export function UsersAdmin({ currentUserId, onSelfChanged }: { currentUserId: string; onSelfChanged: () => void }) {
  const [catalog, setCatalog] = useState<AdminCapability[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRound, setCatalogRound] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listRound, setListRound] = useState(0);
  const [list, setList] = useState<ListState>({ status: "loading", previous: null });
  const [creating, setCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    listCapabilities({ signal: controller.signal }).then(
      (items) => { if (!controller.signal.aborted) setCatalog(items); },
      (failure: unknown) => { if (!controller.signal.aborted && !isAborted(failure)) setCatalogError(adminErrorMessage(failure)); },
    );
    return () => controller.abort();
  }, [catalogRound]);

  useEffect(() => {
    const controller = new AbortController();
    listUsers({ limit: USERS_PAGE_SIZE, offset }, { signal: controller.signal }).then(
      (page) => { if (!controller.signal.aborted) setList({ status: "ready", page }); },
      (failure: unknown) => { if (!controller.signal.aborted && !isAborted(failure)) setList({ status: "error", message: adminErrorMessage(failure) }); },
    );
    return () => controller.abort();
  }, [offset, listRound]);

  /** Nova carga (página, retry, criação) mantém a página anterior visível enquanto aguarda. */
  const loadList = (nextOffset: number) => {
    setList((current) => ({ status: "loading", previous: current.status === "ready" ? current.page : current.status === "loading" ? current.previous : null }));
    setOffset(nextOffset);
    setListRound((round) => round + 1);
  };

  /** Atualiza o item alterado no lugar, preservando a ordem recebida da API. */
  const replaceUser = useCallback((user: AdminUser) => {
    setList((current) => current.status !== "ready" ? current : {
      status: "ready",
      page: { ...current.page, items: current.page.items.map((item) => (item.user_id === user.user_id ? user : item)) },
    });
  }, []);

  const restoreCreateFocus = useRef(false);
  useEffect(() => {
    if (creating || !restoreCreateFocus.current) return;
    restoreCreateFocus.current = false;
    createButtonRef.current?.focus();
  }, [creating]);

  const closeCreate = () => {
    restoreCreateFocus.current = true;
    setCreating(false);
  };

  const created = ({ displayName }: { userId: string; displayName: string }) => {
    setAnnouncement(`Usuário ${displayName} criado com acesso ao Sentinel.`);
    loadList(offset);
    closeCreate();
  };

  const returnFocusTo = useRef<string | null>(null);
  useEffect(() => {
    if (selectedUserId || !returnFocusTo.current) return;
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-user-id="${returnFocusTo.current}"]`)?.focus();
    returnFocusTo.current = null;
  }, [selectedUserId]);

  const closeDetail = useCallback(() => {
    returnFocusTo.current = selectedUserId;
    setSelectedUserId(null);
  }, [selectedUserId]);

  const page = list.status === "ready" ? list.page : list.status === "loading" ? list.previous : null;
  const loading = list.status === "loading";
  const pageNumber = Math.floor(offset / USERS_PAGE_SIZE) + 1;

  return <section className="admin-area" aria-labelledby="admin-users-title">
    <div className="admin-area__header">
      <div>
        <h2 id="admin-users-title">Usuários</h2>
        <p className="muted">Contas locais do Sentinel, situação de acesso e capabilities concedidas.</p>
      </div>
      {!creating && <button ref={createButtonRef} type="button" className="primary-button primary-button--compact" onClick={() => { setAnnouncement(""); setCreating(true); }}>
        <UserPlus aria-hidden="true" size={16} />Novo usuário
      </button>}
    </div>

    <div role="status" aria-live="polite" className="admin-area__status">
      {announcement && <p className="admin-status">{announcement}</p>}
    </div>

    {creating && <UserCreateForm onCreated={created} onCancel={closeCreate} />}

    {catalogError && <div className="results-error" role="alert">
      <p>Catálogo de capabilities indisponível: {catalogError}</p>
      <button type="button" className="secondary-button" onClick={() => { setCatalogError(null); setCatalogRound((round) => round + 1); }}>Tentar novamente</button>
    </div>}

    <div className={`admin-users__layout ${selectedUserId ? "admin-users__layout--detail" : ""}`}>
      <div className="admin-card admin-users__list" aria-busy={loading}>
        {list.status === "error" && <div className="results-error" role="alert">
          <p>{list.message}</p>
          <button type="button" className="secondary-button" onClick={() => loadList(offset)}>Tentar novamente</button>
        </div>}
        {loading && !page && <p className="loading-state"><span className="mini-spinner" aria-hidden="true" />Carregando usuários…</p>}
        {page && page.items.length === 0 && <p className="empty-state">{offset === 0 ? "Nenhum usuário cadastrado." : "Nenhum usuário nesta página."}</p>}
        {page && page.items.length > 0 && <div className="table-scroll" ref={tableRef}>
          <table className="results-table admin-users__table">
            <caption>Usuários do Sentinel, página {pageNumber}</caption>
            <thead><tr><th scope="col">Nome</th><th scope="col">Situação</th><th scope="col">Capabilities</th><th scope="col">Atualizado em</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {page.items.map((user) => <tr key={user.user_id} className={user.user_id === selectedUserId ? "admin-users__row--selected" : undefined}>
                <th scope="row" className="admin-users__name">
                  {user.display_name}{user.user_id === currentUserId && <span className="admin-self"> (você)</span>}
                  <span className="cell-secondary">{user.login_name}</span>
                </th>
                <td><AccessBadge active={user.active} /></td>
                <td>{user.permissions.length
                  ? <ul className="admin-chips">{user.permissions.map((code) => <li key={code} className="criteria-chip">{capabilityLabel(code, catalog)}</li>)}</ul>
                  : <span className="muted">Nenhuma</span>}</td>
                <td>{formatAdminTimestamp(user.updated_at)}</td>
                <td><button type="button" className="table-action" data-user-id={user.user_id}
                  aria-label={`Gerenciar ${user.display_name}`} aria-expanded={user.user_id === selectedUserId} aria-controls={user.user_id === selectedUserId ? "user-detail" : undefined}
                  onClick={() => setSelectedUserId(user.user_id)}>Gerenciar</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
        {page && (offset > 0 || page.has_more) && <nav className="pagination admin-pagination" aria-label="Paginação de usuários">
          <p>Página {pageNumber}{page.items.length > 0 && ` · usuários ${offset + 1}–${offset + page.items.length}`}</p>
          <div className="pagination-buttons">
            <button type="button" className="secondary-button" disabled={loading || offset === 0} onClick={() => loadList(Math.max(0, offset - USERS_PAGE_SIZE))}>Anterior</button>
            <button type="button" className="secondary-button" disabled={loading || !page.has_more} onClick={() => loadList(offset + USERS_PAGE_SIZE)}>Próxima</button>
          </div>
        </nav>}
      </div>

      {selectedUserId && <div id="user-detail" className="admin-users__detail">
        <UserDetailPanel
          key={selectedUserId}
          userId={selectedUserId}
          currentUserId={currentUserId}
          catalog={catalog}
          onUserChanged={replaceUser}
          onClose={closeDetail}
          onSelfChanged={onSelfChanged}
        />
      </div>}
    </div>
  </section>;
}
