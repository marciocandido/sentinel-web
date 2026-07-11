import { useEffect, useRef, useState } from "react";
import type { DiscoveryEstablishment } from "../../types/api";
import { detailValue, matchLabel } from "./discoveryUtils";
import { DiscoveryDetailField } from "./DiscoveryDetailField";

interface DiscoveryDetailsDrawerProps {
  establishment: DiscoveryEstablishment;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}

type ClipboardFeedback = {
  cnpj: string;
  kind: "success" | "error";
};

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function DiscoveryDetailsDrawer({
  establishment,
  onClose,
  returnFocusTo,
}: DiscoveryDetailsDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [returnFocusTarget] = useState(returnFocusTo);
  const [clipboardFeedback, setClipboardFeedback] = useState<ClipboardFeedback | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [onClose, returnFocusTarget]);

  const copyCnpj = async () => {
    try {
      await navigator.clipboard.writeText(establishment.cnpj_full);
      setClipboardFeedback({ cnpj: establishment.cnpj_full, kind: "success" });
    } catch {
      setClipboardFeedback({ cnpj: establishment.cnpj_full, kind: "error" });
    }
  };

  const visibleFeedback = clipboardFeedback?.cnpj === establishment.cnpj_full
    ? clipboardFeedback
    : null;

  return (
    <div className="details-layer">
      <div className="details-overlay" aria-hidden="true" />
      <aside
        ref={dialogRef}
        className="details-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        aria-describedby="details-description"
      >
        <header className="details-header">
          <div>
            <p className="eyebrow">Resultado atual</p>
            <h2 id="details-title">Detalhes do estabelecimento</h2>
            <p id="details-description">Dados disponíveis na página de resultados, sem consulta adicional.</p>
          </div>
          <button
            ref={closeButtonRef}
            className="details-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="details-content">
          <section aria-labelledby="identification-title">
            <h3 id="identification-title">Identificação</h3>
            <dl className="details-list">
              <DiscoveryDetailField label="Razão social" value={detailValue(establishment.razao_social)} />
              <DiscoveryDetailField label="Nome fantasia" value={detailValue(establishment.nome_fantasia)} />
              <DiscoveryDetailField label="CNPJ completo" value={establishment.cnpj_full} code />
              <DiscoveryDetailField label="CNPJ raiz" value={establishment.cnpj_root} code />
            </dl>
          </section>

          <section aria-labelledby="location-title">
            <h3 id="location-title">Localização</h3>
            <dl className="details-list details-list--columns">
              <DiscoveryDetailField label="Município" value={detailValue(establishment.municipio_nome)} />
              <DiscoveryDetailField label="UF" value={detailValue(establishment.uf)} code />
              <DiscoveryDetailField label="Código TOM" value={detailValue(establishment.codigo_tom)} code />
              <DiscoveryDetailField label="Código IBGE" value={detailValue(establishment.codigo_ibge)} code />
              <DiscoveryDetailField label="Precisão geográfica" value={detailValue(establishment.location_precision)} />
              <DiscoveryDetailField
                label="Geografia"
                value={establishment.has_geo ? "Geografia disponível" : "Geografia não disponível"}
              />
            </dl>
          </section>

          <section aria-labelledby="classification-title">
            <h3 id="classification-title">Classificação</h3>
            <dl className="details-list details-list--columns">
              <DiscoveryDetailField label="CNAE principal" value={detailValue(establishment.cnae_principal)} code />
              <DiscoveryDetailField label="Porte" value={detailValue(establishment.porte_codigo)} code />
              <DiscoveryDetailField label="Capital social" value={detailValue(establishment.capital_social)} code />
              <DiscoveryDetailField label="Correspondência da busca" value={matchLabel(establishment)} />
            </dl>
          </section>

          <section aria-labelledby="commercial-title">
            <h3 id="commercial-title">Situação comercial</h3>
            <dl className="details-list">
              <DiscoveryDetailField label="Status" value="Desconhecido" />
              <DiscoveryDetailField label="Fonte" value="nenhuma integração comercial disponível" />
            </dl>
          </section>
        </div>

        <footer className="details-footer">
          <div className="clipboard-feedback" aria-live="polite">
            {visibleFeedback?.kind === "success" && "CNPJ copiado."}
            {visibleFeedback?.kind === "error" && "Não foi possível copiar o CNPJ."}
          </div>
          <button className="primary-button" type="button" onClick={() => void copyCnpj()}>
            Copiar CNPJ
          </button>
        </footer>
      </aside>
    </div>
  );
}
