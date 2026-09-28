import { CheckCircle2, CircleSlash, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getUser, getUserPermissions, grantPermission, revokePermission, setUserAccess } from "../../services/adminApi";
import type { AdminCapability, AdminUser } from "../../types/api";
import { AdminConfirmDialog, type AdminConfirmation } from "./AdminConfirmDialog";
import {
  ACCESS_PERMISSION,
  adminErrorCode,
  adminErrorMessage,
  capabilityLabel,
  DEACTIVATION_NOTICE,
  formatAdminTimestamp,
  isAborted,
  selfRevokeImpact,
} from "./adminPresentation";
import { ADMIN_SECTIONS } from "./adminSections";

type Mutation =
  | { kind: "access"; active: boolean }
  | { kind: "grant"; permission: string }
  | { kind: "revoke"; permission: string };

// Após estes erros o estado mostrado pode estar defasado: recarrega-se o usuário.
const RECONCILE_CODES = new Set(["permission_conflict", "permission_not_found", "user_not_found"]);

export function AccessBadge({ active }: { active: boolean }) {
  return <span className={`admin-access ${active ? "admin-access--active" : "admin-access--inactive"}`}>
    {active ? <CheckCircle2 aria-hidden="true" size={14} /> : <CircleSlash aria-hidden="true" size={14} />}
    {active ? "Ativo" : "Inativo"}
  </span>;
}

function confirmationFor(mutation: Mutation, user: AdminUser, self: boolean, label: string): AdminConfirmation | null {
  if (mutation.kind === "access") {
    if (mutation.active) return null;
    return self
      ? {
        title: "Desativar o seu próprio acesso?",
        description: `${DEACTIVATION_NOTICE} Isso inclui a sua sessão atual: você sairá do Sentinel imediatamente e somente outro administrador poderá reativar a sua conta. O usuário não é apagado.`,
        confirmLabel: "Desativar meu acesso",
        acknowledgement: "Entendo que vou perder o acesso ao Sentinel agora.",
      }
      : {
        title: `Desativar o acesso de ${user.display_name}?`,
        description: `${DEACTIVATION_NOTICE} O usuário não é apagado: o cadastro e as capabilities permanecem, e o acesso pode ser reativado depois, com novo login.`,
        confirmLabel: "Desativar acesso",
        acknowledgement: null,
      };
  }
  if (mutation.kind !== "revoke") return null;
  const impact = self ? selfRevokeImpact(mutation.permission) : null;
  if (impact === "ends_session") return {
    title: `Revogar o seu próprio “${label}”?`,
    description: "Sem esta capability você não consegue usar o Sentinel. A sua sessão atual será encerrada imediatamente e somente outro administrador poderá conceder o acesso novamente.",
    confirmLabel: "Revogar meu acesso",
    acknowledgement: "Entendo que vou perder o acesso ao Sentinel agora.",
  };
  if (impact === "loses_admin_area") {
    const areas = ADMIN_SECTIONS.filter((section) => section.permission === mutation.permission).map((section) => section.label).join(", ");
    return {
      title: `Revogar o seu próprio “${label}”?`,
      description: `Você perderá imediatamente a área ${areas} da Administração, inclusive esta tela. Somente outro administrador poderá conceder a capability novamente.`,
      confirmLabel: "Revogar minha capability",
      acknowledgement: "Entendo que vou perder esta área administrativa agora.",
    };
  }
  if (mutation.permission === ACCESS_PERMISSION) return {
    title: `Revogar “${label}” de ${user.display_name}?`,
    description: "Sem esta capability o usuário não consegue usar o Sentinel, e as sessões existentes desse usuário são encerradas. Conceder novamente exige novo login.",
    confirmLabel: "Revogar",
    acknowledgement: null,
  };
  return null;
}

/**
 * Detalhe administrativo de um usuário: acesso e capabilities. O catálogo do
 * backend é a autoridade de label/descrição; cada capability é independente.
 * Alterações no próprio usuário continuam permitidas, com confirmação forte, e
 * a sessão é reavaliada depois — perder o acesso volta ao login sem erro.
 */
export function UserDetailPanel({ userId, currentUserId, catalog, onUserChanged, onClose, onSelfChanged }: {
  userId: string;
  currentUserId: string;
  catalog: readonly AdminCapability[] | null;
  onUserChanged: (user: AdminUser) => void;
  onClose: () => void;
  onSelfChanged: () => void;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRound, setLoadRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<{ mutation: Mutation; confirmation: AdminConfirmation } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const mutationController = useRef<AbortController | null>(null);
  const self = userId === currentUserId;

  useEffect(() => {
    const controller = new AbortController();
    getUser(userId, { signal: controller.signal }).then(
      (loaded) => { if (!controller.signal.aborted) { setLoadError(null); setUser(loaded); onUserChanged(loaded); } },
      (failure: unknown) => { if (!controller.signal.aborted && !isAborted(failure)) setLoadError(adminErrorMessage(failure)); },
    );
    return () => controller.abort();
  }, [userId, loadRound, onUserChanged]);

  useEffect(() => { headingRef.current?.focus(); }, [userId]);
  useEffect(() => () => mutationController.current?.abort(), []);

  const labelOf = (code: string) => capabilityLabel(code, catalog);

  // Devolve o foco ao controle de origem depois que diálogo e envio terminam e os botões voltam a habilitar.
  const focusPending = useRef(false);
  const restoreFocus = () => { focusPending.current = true; };
  useEffect(() => {
    if (busy || pending || !focusPending.current) return;
    focusPending.current = false;
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
  });

  const run = async (mutation: Mutation) => {
    if (!user || busy) return;
    const controller = new AbortController();
    mutationController.current = controller;
    const signal = controller.signal;
    setBusy(true);
    setError(null);
    setStatus("");
    try {
      if (mutation.kind === "access") await setUserAccess(user.user_id, mutation.active, { signal });
      else if (mutation.kind === "grant") await grantPermission(user.user_id, mutation.permission, { signal });
      else await revokePermission(user.user_id, mutation.permission, { signal });
      setPending(null);
      const endsOwnSession = self && ((mutation.kind === "access" && !mutation.active)
        || (mutation.kind === "revoke" && mutation.permission === ACCESS_PERMISSION));
      if (endsOwnSession) {
        // A sessão atual foi revogada pelo backend na mesma transação; a fronteira de acesso assume.
        onSelfChanged();
        return;
      }
      let next: AdminUser;
      if (mutation.kind === "access") next = await getUser(user.user_id, { signal });
      else next = { ...user, permissions: (await getUserPermissions(user.user_id, { signal })).permissions };
      setUser(next);
      onUserChanged(next);
      setStatus(mutation.kind === "access"
        ? `Acesso de ${next.display_name} ${mutation.active ? "reativado" : "desativado"}.`
        : `“${labelOf(mutation.permission)}” ${mutation.kind === "grant" ? "concedida a" : "revogada de"} ${next.display_name}.`);
      if (self) onSelfChanged();
    } catch (failure) {
      if (isAborted(failure)) return;
      setPending(null);
      setError(adminErrorMessage(failure));
      if (RECONCILE_CODES.has(adminErrorCode(failure))) setLoadRound((round) => round + 1);
    } finally {
      if (!signal.aborted) {
        setBusy(false);
        restoreFocus();
      }
    }
  };

  const request = (mutation: Mutation) => {
    if (!user) return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const label = mutation.kind === "access" ? "" : labelOf(mutation.permission);
    const confirmation = confirmationFor(mutation, user, self, label);
    if (confirmation) setPending({ mutation, confirmation });
    else void run(mutation);
  };

  const cancelPending = useCallback(() => {
    focusPending.current = true;
    setPending(null);
  }, []);

  const title = user ? user.display_name : "Usuário";
  const outsideCatalog = user && catalog ? user.permissions.filter((code) => !catalog.some((capability) => capability.code === code)) : [];

  return <section className="admin-card admin-detail" aria-labelledby="user-detail-title" aria-busy={busy || (!user && !loadError)}>
    <div className="admin-detail__header">
      <div className="admin-detail__identity">
        <h3 id="user-detail-title" ref={headingRef} tabIndex={-1}>{title}{self && <span className="admin-self"> (você)</span>}</h3>
        {user && <p className="admin-detail__login">Login: <span className="cell-code">{user.login_name}</span></p>}
      </div>
      <button type="button" className="icon-button" aria-label="Fechar detalhe do usuário" onClick={onClose}><X aria-hidden="true" size={18} /></button>
    </div>

    {!user && !loadError && <p className="loading-state"><span className="mini-spinner" aria-hidden="true" />Carregando usuário…</p>}
    {loadError && !user && <div className="results-error" role="alert"><p>{loadError}</p><button type="button" className="secondary-button" onClick={() => { setLoadError(null); setLoadRound((round) => round + 1); }}>Tentar novamente</button></div>}

    {user && <>
      <dl className="admin-detail__facts">
        <div><dt>Situação</dt><dd><AccessBadge active={user.active} /></dd></div>
        <div><dt>Criado em</dt><dd>{formatAdminTimestamp(user.created_at)}</dd></div>
        <div><dt>Atualizado em</dt><dd>{formatAdminTimestamp(user.updated_at)}</dd></div>
      </dl>

      <div className="admin-detail__section">
        <h4>Acesso</h4>
        {user.active
          ? <><p className="muted">{DEACTIVATION_NOTICE} O usuário não é apagado.</p>
            <button type="button" className="secondary-button admin-danger-outline" disabled={busy} onClick={() => request({ kind: "access", active: false })}>Desativar acesso</button></>
          : <><p className="muted">Reativar não restaura sessões antigas: o usuário precisa entrar novamente.</p>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => request({ kind: "access", active: true })}>Reativar acesso</button></>}
      </div>

      <div className="admin-detail__section">
        <h4 id="user-capabilities-title">Capabilities</h4>
        {catalog
          ? <ul className="admin-capabilities" aria-labelledby="user-capabilities-title">
            {catalog.map((capability) => {
              const granted = user.permissions.includes(capability.code);
              return <li key={capability.code} className="admin-capability">
                <div className="admin-capability__text">
                  <p className="admin-capability__label">{capability.label}</p>
                  <p className="admin-capability__description">{capability.description}</p>
                  <p className="admin-capability__meta"><span className="cell-code">{capability.code}</span> · <span className={granted ? "admin-granted" : "admin-not-granted"}>{granted ? "Concedida" : "Não concedida"}</span></p>
                </div>
                <button type="button" className="table-action" disabled={busy}
                  aria-label={`${granted ? "Revogar" : "Conceder"} ${capability.label}`}
                  onClick={() => request(granted ? { kind: "revoke", permission: capability.code } : { kind: "grant", permission: capability.code })}>
                  {granted ? "Revogar" : "Conceder"}
                </button>
              </li>;
            })}
          </ul>
          : <p className="muted">Catálogo de capabilities indisponível. Concedidas: {user.permissions.length ? user.permissions.join(", ") : "nenhuma"}.</p>}
        {outsideCatalog.length > 0 && <p className="validation-message">Capabilities fora do catálogo: {outsideCatalog.join(", ")}.</p>}
      </div>
    </>}

    <div role="status" aria-live="polite" className="admin-detail__messages">
      {status && <p className="admin-status">{status}</p>}
    </div>
    {error && <p className="results-error admin-detail__error" role="alert">{error}</p>}

    {pending && <AdminConfirmDialog confirmation={pending.confirmation} busy={busy} onCancel={cancelPending} onConfirm={() => void run(pending.mutation)} />}
  </section>;
}
