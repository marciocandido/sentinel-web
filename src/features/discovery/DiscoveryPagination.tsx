import type { PaginationMeta } from "../../types/api";

interface DiscoveryPaginationProps {
  pagination: PaginationMeta;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
}

export function DiscoveryPagination({
  pagination,
  disabled,
  onPrevious,
  onNext,
  onLimitChange,
}: DiscoveryPaginationProps) {
  const page = Math.floor(pagination.offset / pagination.limit) + 1;
  return (
    <div className="pagination" aria-label="Paginação dos resultados">
      <p>Página {page} · {pagination.returned} resultado(s) nesta página</p>
      <label htmlFor="page-limit">Resultados por página</label>
      <select
        id="page-limit"
        value={pagination.limit}
        disabled={disabled}
        onChange={(event) => onLimitChange(Number(event.target.value))}
      >
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <div className="pagination-buttons">
        <button type="button" className="secondary-button" onClick={onPrevious} disabled={disabled || pagination.offset === 0}>
          Anterior
        </button>
        <button type="button" className="secondary-button" onClick={onNext} disabled={disabled || !pagination.has_more}>
          Próxima
        </button>
      </div>
    </div>
  );
}
