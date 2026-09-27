import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LoginCredentials } from "../../services/authApi";
import type { AuthNotice, LoginField } from "./authPresentation";

const MESSAGE_ID = "login-message";

/**
 * A senha vive apenas neste estado local, é descartada a cada envio e ao
 * desmontar a tela; não é registrada nem persistida.
 */
export function LoginView({ busy, notice, onSubmit }: {
  busy: boolean;
  notice: AuthNotice | null;
  onSubmit: (credentials: LoginCredentials) => void;
}) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [missing, setMissing] = useState<LoginField | null>(null);
  const loginRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice || notice.tone !== "error") return;
    // O botão fica desabilitado durante o envio; o foco volta a um campo útil.
    (notice.field === "password" ? passwordRef : loginRef).current?.focus();
  }, [notice]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const name = loginName.trim();
    if (!name) { setMissing("login"); loginRef.current?.focus(); return; }
    if (!password) { setMissing("password"); passwordRef.current?.focus(); return; }
    setMissing(null);
    setPassword("");
    onSubmit({ loginName: name, password });
  };

  const shown: AuthNotice | null = missing
    ? { tone: "error", message: missing === "login" ? "Informe o usuário." : "Informe a senha.", field: missing }
    : busy ? null : notice;
  const invalidField = shown?.tone === "error" ? shown.field : null;
  // Credencial recusada não revela qual campo errou: ambos ficam inválidos.
  const loginInvalid = invalidField === "login" || (invalidField === "password" && !missing);
  const passwordInvalid = invalidField === "password";
  const describedBy = shown ? MESSAGE_ID : undefined;

  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card__brand">
        <span className="brand-mark" aria-hidden="true">S</span>
        <div><p className="product-name">Sentinel</p><p className="product-context">Discovery Comercial</p></div>
      </div>
      <h1 id="login-title">Entrar</h1>
      <form className="auth-form" onSubmit={submit} aria-busy={busy} noValidate>
        <div className="field-group">
          <label htmlFor="login-name">Usuário</label>
          <input
            ref={loginRef}
            id="login-name"
            autoFocus
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={loginName}
            onChange={(event) => { setLoginName(event.target.value); if (missing === "login") setMissing(null); }}
            aria-invalid={loginInvalid ? true : undefined}
            aria-describedby={describedBy}
          />
        </div>
        <div className="field-group">
          <label htmlFor="login-password">Senha</label>
          <input
            ref={passwordRef}
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => { setPassword(event.target.value); if (missing === "password") setMissing(null); }}
            aria-invalid={passwordInvalid ? true : undefined}
            aria-describedby={describedBy}
          />
        </div>
        <div id={MESSAGE_ID} className="auth-form__message" aria-live="polite">
          {shown && <p className={shown.tone === "error" ? "auth-message auth-message--error" : "auth-message"} role={shown.tone === "error" ? "alert" : undefined}>{shown.message}</p>}
        </div>
        <button className="primary-button auth-form__submit" type="submit" disabled={busy}>
          {busy && <span className="mini-spinner" aria-hidden="true" />}
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </section>
  </main>;
}
