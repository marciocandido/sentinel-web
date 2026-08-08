import { useEffect, useRef } from "react";
import { formatBytes } from "./bootstrapPresentation";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface BootstrapConfirmDialogProps {
  competence: string;
  download: number | null;
  reusable: number;
  remaining: number | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  retry: boolean;
}

export function BootstrapConfirmDialog({
  competence, download, reusable, remaining, busy, onCancel, onConfirm, retry,
}: BootstrapConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="bootstrap-dialog-layer">
      <button type="button" aria-label="Fechar confirmação" disabled={busy} onClick={onCancel} />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="bootstrap-confirm-title" aria-describedby="bootstrap-confirm-description" aria-busy={busy}>
        <h2 id="bootstrap-confirm-title">{retry ? "Tentar preparar a base novamente?" : "Preparar base da Receita?"}</h2>
        <p id="bootstrap-confirm-description">
          Competência: {competence}<br />
          Download publicado: {formatBytes(download, "Não informado")}<br />
          Já disponível no servidor: {formatBytes(reusable, "Não calculado")}<br />
          Download restante: {formatBytes(remaining, "Não calculado")}<br /><br />
          A preparação acontece no servidor e continua mesmo se esta página for fechada.
        </p>
        <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={busy} onClick={onConfirm}>{busy ? "Preparando..." : "Preparar base"}</button>
      </section>
    </div>
  );
}
