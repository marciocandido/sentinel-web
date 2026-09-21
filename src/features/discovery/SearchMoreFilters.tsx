import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

interface SearchMoreFiltersProps {
  /** Quantidade de filtros complementares preenchidos ou ativos no formulário atual. */
  filled?: number;
  children: ReactNode;
}

/**
 * Bloco recolhido de filtros complementares e opções da busca. O conteúdo
 * permanece montado para que abrir ou recolher não descarte valores digitados.
 */
export function SearchMoreFilters({ filled = 0, children }: SearchMoreFiltersProps) {
  return (
    <details className="advanced-filters">
      <summary>
        <SlidersHorizontal className="advanced-filters__icon" aria-hidden="true" size={15} />
        <span>Mais filtros e opções</span>
        {filled > 0 && (
          <span className="advanced-filters__badge">
            {filled}
            <span className="sr-only"> filtro(s) complementar(es) em uso</span>
          </span>
        )}
      </summary>
      <div className="advanced-filters__content">{children}</div>
    </details>
  );
}
