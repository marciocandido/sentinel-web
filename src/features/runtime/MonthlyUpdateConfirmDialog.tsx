import { useEffect, useRef } from "react";
import type { UpdatePreflightResponse } from "../../types/api";
import { formatBytes } from "./bootstrapPresentation";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MonthlyUpdateConfirmDialog({ preflight, busy, onCancel, onConfirm }: {
  preflight: UpdatePreflightResponse;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [busy, onCancel]);

  return <div className="bootstrap-dialog-layer monthly-update-dialog-layer">
    <button type="button" aria-label="Fechar confirmação" disabled={busy} onClick={onCancel} />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="monthly-update-confirm-title" aria-describedby="monthly-update-confirm-description" aria-busy={busy}>
      <h2 id="monthly-update-confirm-title">Atualizar base da Receita?</h2>
      <p id="monthly-update-confirm-description">
        Base atual: {preflight.active_competence ?? "Não confirmada"}<br />
        Nova competência: {preflight.target_competence ?? "Não confirmada"}<br />
        Download publicado: {formatBytes(preflight.download_bytes, "Não informado")}<br />
        Download restante: {formatBytes(preflight.remaining_download_bytes, "Não calculado")}<br /><br />
        A base atual continuará disponível durante a preparação.<br /><br />
        Quando a nova geração estiver validada, o servidor fará a promoção. Se a validação pós-promoção falhar, o backend executará o rollback online quando possível.<br /><br />
        O processo continua no servidor mesmo que esta página seja fechada.
      </p>
      <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="button" disabled={busy} aria-busy={busy} onClick={onConfirm}>{busy ? "Autorizando..." : "Confirmar atualização"}</button>
    </section>
  </div>;
}
