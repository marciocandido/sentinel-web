import { useEffect, useRef, useState, type FormEvent } from "react";
import { createUser } from "../../services/adminApi";
import { adminErrorCode, adminErrorMessage, isAborted, PASSWORD_MIN_LENGTH } from "./adminPresentation";

type Field = "displayName" | "loginName" | "password" | "confirmation";

interface FormError {
  field: Field | null;
  message: string;
}

/**
 * Criação de usuário local. A senha vive só neste estado, é descartada a cada
 * envio (com sucesso ou não) e ao desmontar; nunca é persistida, registrada
 * nem reexibida. O backend concede inicialmente apenas `sentinel:access`.
 */
export function UserCreateForm({ onCreated, onCancel }: {
  onCreated: (created: { userId: string; displayName: string }) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const loginNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    displayNameRef.current?.focus();
    return () => controller.current?.abort();
  }, []);

  const fail = (next: FormError) => {
    setError(next);
    const target = { displayName: displayNameRef, loginName: loginNameRef, password: passwordRef, confirmation: confirmationRef };
    if (next.field) target[next.field].current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const name = displayName.trim();
    const login = loginName.trim();
    if (!name) return fail({ field: "displayName", message: "Informe o nome." });
    if (!login) return fail({ field: "loginName", message: "Informe o usuário (login)." });
    if (password.length < PASSWORD_MIN_LENGTH) return fail({ field: "password", message: `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.` });
    if (confirmation !== password) return fail({ field: "confirmation", message: "A confirmação não confere com a senha." });
    const secret = password;
    setPassword("");
    setConfirmation("");
    setError(null);
    setBusy(true);
    controller.current = new AbortController();
    try {
      const created = await createUser({ displayName: name, loginName: login, password: secret }, { signal: controller.current.signal });
      onCreated({ userId: created.user_id, displayName: name });
    } catch (failure) {
      if (isAborted(failure)) return;
      setBusy(false);
      const code = adminErrorCode(failure);
      fail({
        field: code === "user_conflict" ? "loginName" : code === "invalid_request" ? "displayName" : null,
        message: adminErrorMessage(failure),
      });
    }
  };

  const invalid = (field: Field) => (error?.field === field ? true : undefined);
  const describedBy = (field: Field, hint?: string) => [hint, error?.field === field ? "user-create-error" : undefined].filter(Boolean).join(" ") || undefined;

  return <form className="admin-card admin-create" onSubmit={(event) => void submit(event)} onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); } }} aria-busy={busy} aria-labelledby="user-create-title" noValidate>
    <h3 id="user-create-title">Novo usuário</h3>
    <p className="muted admin-create__note">O novo usuário recebe inicialmente somente o acesso ao Sentinel. Outras capabilities são concedidas depois, no detalhe do usuário.</p>
    <div className="admin-create__grid">
      <div className="field-group">
        <label htmlFor="user-create-name">Nome</label>
        <input ref={displayNameRef} id="user-create-name" autoComplete="off" value={displayName} readOnly={busy}
          onChange={(event) => setDisplayName(event.target.value)} aria-invalid={invalid("displayName")} aria-describedby={describedBy("displayName")} />
      </div>
      <div className="field-group">
        <label htmlFor="user-create-login">Usuário (login)</label>
        <input ref={loginNameRef} id="user-create-login" autoComplete="off" autoCapitalize="none" spellCheck={false} value={loginName} readOnly={busy}
          onChange={(event) => setLoginName(event.target.value)} aria-invalid={invalid("loginName")} aria-describedby={describedBy("loginName")} />
      </div>
      <div className="field-group">
        <label htmlFor="user-create-password">Senha</label>
        <input ref={passwordRef} id="user-create-password" type="password" autoComplete="new-password" value={password} readOnly={busy}
          onChange={(event) => setPassword(event.target.value)} aria-invalid={invalid("password")} aria-describedby={describedBy("password", "user-create-password-hint")} />
        <p id="user-create-password-hint" className="field-hint">Mínimo de {PASSWORD_MIN_LENGTH} caracteres. A senha não é exibida depois da criação.</p>
      </div>
      <div className="field-group">
        <label htmlFor="user-create-confirmation">Confirmar senha</label>
        <input ref={confirmationRef} id="user-create-confirmation" type="password" autoComplete="new-password" value={confirmation} readOnly={busy}
          onChange={(event) => setConfirmation(event.target.value)} aria-invalid={invalid("confirmation")} aria-describedby={describedBy("confirmation")} />
      </div>
    </div>
    <div aria-live="polite">
      {error && <p id="user-create-error" className="validation-message" role="alert">{error.message}</p>}
    </div>
    <div className="admin-create__actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="primary-button primary-button--compact" disabled={busy}>
        {busy && <span className="mini-spinner" aria-hidden="true" />}
        {busy ? "Criando…" : "Criar usuário"}
      </button>
    </div>
  </form>;
}
