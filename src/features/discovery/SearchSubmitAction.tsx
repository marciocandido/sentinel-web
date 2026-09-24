import { Search } from "lucide-react";

/**
 * Ação principal da busca, posicionada no início da linha dos filtros
 * principais de todos os modos. Continua sendo o `submit` do formulário, de
 * modo que Enter em qualquer campo mantém o mesmo caminho de envio.
 */
export function SearchSubmitAction({ searching, label = "Buscar" }: { searching: boolean; label?: string }) {
  return (
    <div className="field-group field-group--action">
      <button className="primary-button" type="submit" disabled={searching} aria-busy={searching || undefined}>
        <Search aria-hidden="true" size={16} />
        {searching ? "Buscando..." : label}
      </button>
    </div>
  );
}
