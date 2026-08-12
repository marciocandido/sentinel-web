import type {
  DiscoveryExportFormat,
  DiscoveryExportSearch,
} from "../../services/sentinelApi";
import { publicDiscoveryExportError } from "./discoveryExport";
import type { DiscoveryExportState } from "./useDiscoveryExport";

interface DiscoveryExportActionsProps {
  search: DiscoveryExportSearch | null;
  state: DiscoveryExportState;
  onExport: (format: DiscoveryExportFormat, search: DiscoveryExportSearch) => void;
}

export function DiscoveryExportActions({
  search,
  state,
  onExport,
}: DiscoveryExportActionsProps) {
  if (!search) return null;
  const loading = state.kind === "loading";
  return (
    <div className="export-actions" aria-busy={loading}>
      <div className="export-actions__buttons" role="group" aria-label="Exportar resultados completos">
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={() => onExport("CSV", search)}
        >
          Exportar CSV
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={() => onExport("XLSX", search)}
        >
          Exportar Excel
        </button>
      </div>
      {state.kind === "loading" && (
        <p role="status">Preparando arquivo {state.format === "CSV" ? "CSV" : "Excel"}...</p>
      )}
      {state.kind === "success" && (
        <p className="export-actions__success" aria-live="polite">Arquivo preparado para download.</p>
      )}
      {state.kind === "error" && (
        <p className="export-actions__error" role="alert">
          {publicDiscoveryExportError(state.code)}
        </p>
      )}
    </div>
  );
}
