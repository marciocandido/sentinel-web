import { useEffect, useId, useRef, useState } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AdminConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  /** Ação sobre o próprio usuário: exige reconhecimento explícito antes de confirmar. */
  acknowledgement: string | null;
}

/**
 * Confirmação modal de ação administrativa. Foco inicial em Cancelar, Tab
 * contido, Escape cancela enquanto não há envio; quem abre devolve o foco.
 */
export function AdminConfirmDialog({ confirmation, busy, onCancel, onConfirm }: {
  confirmation: AdminConfirmation;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
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
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  const needsAck = confirmation.acknowledgement !== null;
  return (
    <div className="admin-dialog-layer">
      <button type="button" aria-label="Fechar confirmação" tabIndex={-1} disabled={busy} onClick={onCancel} />
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy}>
        <h2 id={`${id}-title`}>{confirmation.title}</h2>
        <p id={`${id}-description`} className="admin-dialog__description">{confirmation.description}</p>
        {needsAck && <label className="admin-dialog__ack">
          <input type="checkbox" checked={acknowledged} disabled={busy} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>{confirmation.acknowledgement}</span>
        </label>}
        <div className="admin-dialog__actions">
          <button ref={cancelRef} type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button>
          <button type="button" className="danger-button" disabled={busy || (needsAck && !acknowledged)} onClick={onConfirm}>
            {busy ? "Aplicando…" : confirmation.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
