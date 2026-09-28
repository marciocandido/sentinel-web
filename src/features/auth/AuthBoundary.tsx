import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { abortProtectedRequests, SentinelApiError, subscribeSessionEnd } from "../../services/apiClient";
import { getSession, login, logout, type LoginCredentials } from "../../services/authApi";
import type { AuthenticatedSessionResponse, SessionResponse } from "../../types/api";
import { AuthNoticeView, AuthPendingView } from "./AuthStatusView";
import {
  FORBIDDEN_MESSAGES,
  hasPermission,
  LOGOUT_UNCONFIRMED_NOTICE,
  loginFailureNotice,
  SESSION_ENDED_NOTICE,
  SESSION_EXPIRED_NOTICE,
  UNAVAILABLE_MESSAGES,
  type AuthNotice,
  type AuthState,
} from "./authPresentation";
import { LoginView } from "./LoginView";

// Logout que falha por sessão já encerrada ainda termina no login sem alerta.
const LOGOUT_SESSION_GONE = new Set(["not_authenticated", "session_invalid", "session_expired", "csrf_missing", "access_disabled"]);

function errorCode(error: unknown): string {
  return error instanceof SentinelApiError ? error.code : "network_error";
}

function stateFromSession(session: SessionResponse): AuthState {
  if (!session.authenticated) return { status: "anonymous", notice: null };
  if (!hasPermission(session, "sentinel:access")) return { status: "forbidden", reason: "permission_denied" };
  return { status: "authenticated", session };
}

function stateFromSessionError(error: unknown): AuthState {
  const code = errorCode(error);
  if (code === "session_expired") return { status: "anonymous", notice: SESSION_EXPIRED_NOTICE };
  if (code === "session_invalid") return { status: "anonymous", notice: SESSION_ENDED_NOTICE };
  if (code === "not_authenticated") return { status: "anonymous", notice: null };
  if (code === "access_disabled" || code === "permission_denied") return { status: "forbidden", reason: code };
  if (code === "invalid_response" || code === "invalid_json") return { status: "unavailable", reason: "invalid_response" };
  if (code === "auth_unavailable") return { status: "unavailable", reason: "auth_unavailable" };
  return { status: "unavailable", reason: "network" };
}

/**
 * Fronteira de acesso: enquanto a sessão não é confirmada, nenhum subtree que
 * faça request protegido é montado. Sair, expirar ou trocar de pessoa cancela
 * as requests protegidas pendentes e desmonta todo o estado da sessão anterior.
 */
export function AuthBoundary({ app: ProtectedApp }: {
  app: ComponentType<{ session: AuthenticatedSessionResponse; onSignOut: () => void; onSessionRefresh: () => void }>;
}) {
  const [state, setState] = useState<AuthState>({ status: "checking" });
  const [checkRound, setCheckRound] = useState(0);
  const loggingIn = useRef(false);
  const signingOut = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getSession({ signal: controller.signal }).then(
      (session) => { if (!controller.signal.aborted) setState(stateFromSession(session)); },
      (error: unknown) => { if (!controller.signal.aborted) setState(stateFromSessionError(error)); },
    );
    return () => controller.abort();
  }, [checkRound]);

  useEffect(() => subscribeSessionEnd((reason) => {
    abortProtectedRequests();
    setState((current) => {
      if (current.status !== "authenticated") return current;
      if (reason === "access_disabled") return { status: "forbidden", reason };
      return { status: "anonymous", notice: reason === "expired" ? SESSION_EXPIRED_NOTICE : SESSION_ENDED_NOTICE };
    });
  }), []);

  const retry = useCallback(() => {
    setState({ status: "checking" });
    setCheckRound((round) => round + 1);
  }, []);

  /**
   * Reavalia a sessão após uma alteração administrativa no próprio usuário.
   * Permissões novas chegam sem remontar o app. Sessão encerrada — resposta
   * anônima ou erro de sessão (401 `session_invalid`/`session_expired`/
   * `not_authenticated`, 403 `access_disabled`, com a mesma semântica do
   * bootstrap) — desmonta o subtree e volta ao login ou ao acesso negado.
   * Falha transitória (rede, timeout, `auth_unavailable`, resposta inválida)
   * não inventa logout: a sessão atual permanece e as requests protegidas
   * seguintes continuam sendo a autoridade.
   */
  const refreshSession = useCallback(() => {
    const replaceIfEnded = (next: AuthState) => setState((current) => {
      if (current.status !== "authenticated") return current;
      if (next.status === "unavailable") return current;
      if (next.status !== "authenticated") abortProtectedRequests();
      else if (next.session.user_id !== current.session.user_id) return current;
      return next;
    });
    getSession().then(
      (session) => replaceIfEnded(session.authenticated ? stateFromSession(session) : { status: "anonymous", notice: SESSION_ENDED_NOTICE }),
      (error: unknown) => replaceIfEnded(stateFromSessionError(error)),
    );
  }, []);

  const submitLogin = useCallback(async (credentials: LoginCredentials) => {
    if (loggingIn.current) return;
    loggingIn.current = true;
    setState({ status: "authenticating" });
    try {
      const session = await login(credentials);
      setState(session.authenticated ? stateFromSession(session) : { status: "anonymous", notice: { ...loginFailureNotice("invalid_response") } });
    } catch (error) {
      setState({ status: "anonymous", notice: { ...loginFailureNotice(errorCode(error)) } });
    } finally {
      loggingIn.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    abortProtectedRequests();
    setState({ status: "signing_out" });
    let notice: AuthNotice | null = null;
    try {
      await logout();
    } catch (error) {
      if (!LOGOUT_SESSION_GONE.has(errorCode(error))) notice = LOGOUT_UNCONFIRMED_NOTICE;
    } finally {
      signingOut.current = false;
    }
    setState({ status: "anonymous", notice });
  }, []);

  switch (state.status) {
    case "checking":
      return <AuthPendingView label="Verificando acesso ao Sentinel…" />;
    case "signing_out":
      return <AuthPendingView label="Saindo do Sentinel…" />;
    case "anonymous":
    case "authenticating":
      return <LoginView
        busy={state.status === "authenticating"}
        notice={state.status === "anonymous" ? state.notice : null}
        onSubmit={(credentials) => void submitLogin(credentials)}
      />;
    case "forbidden":
      return <AuthNoticeView
        title="Acesso não autorizado"
        message={FORBIDDEN_MESSAGES[state.reason]}
        actionLabel="Entrar com outra conta"
        onAction={() => setState({ status: "anonymous", notice: null })}
      />;
    case "unavailable":
      return <AuthNoticeView
        title="Não foi possível verificar o acesso"
        message={UNAVAILABLE_MESSAGES[state.reason]}
        actionLabel="Tentar novamente"
        onAction={retry}
      />;
    case "authenticated":
      return <ProtectedApp key={state.session.user_id} session={state.session} onSignOut={signOut} onSessionRefresh={refreshSession} />;
  }
}
