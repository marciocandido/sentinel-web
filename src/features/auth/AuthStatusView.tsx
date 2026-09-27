import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

function AuthBrand() {
  return <div className="auth-card__brand">
    <span className="brand-mark" aria-hidden="true">S</span>
    <div><p className="product-name">Sentinel</p><p className="product-context">Discovery Comercial</p></div>
  </div>;
}

/** Verificação de sessão ou saída em andamento: nada protegido está montado. */
export function AuthPendingView({ label }: { label: string }) {
  return <main className="auth-screen">
    <section className="auth-card auth-card--pending" role="status" aria-live="polite" aria-busy="true">
      <AuthBrand />
      <p className="auth-pending"><LoaderCircle className="runtime-panel__spinner" aria-hidden="true" />{label}</p>
    </section>
  </main>;
}

/** Acesso negado ou autenticação indisponível, com uma única ação de saída. */
export function AuthNoticeView({ title, message, actionLabel, onAction }: {
  title: string;
  message: ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-notice-title">
      <AuthBrand />
      <h1 id="auth-notice-title" ref={headingRef} tabIndex={-1}>{title}</h1>
      <p className="auth-message auth-message--error" role="alert">{message}</p>
      <button className="primary-button auth-form__submit" type="button" onClick={onAction}>{actionLabel}</button>
    </section>
  </main>;
}
