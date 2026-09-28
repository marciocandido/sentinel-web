import { useEffect, useRef, useState } from "react";
import type { AdminSection, AdminSectionId } from "./adminSections";
import { UsersAdmin } from "./UsersAdmin";

/**
 * Workspace Administração: mostra somente as áreas cuja capability a sessão
 * possui (ver `adminSections`). Com mais de uma área, um seletor simples
 * alterna entre elas; cada área é montada apenas quando ativa.
 */
export function AdministrationWorkspace({ sections, currentUserId, onSelfChanged }: {
  sections: readonly AdminSection[];
  currentUserId: string;
  onSelfChanged: () => void;
}) {
  const [requested, setRequested] = useState<AdminSectionId | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = sections.find((section) => section.id === requested) ?? sections[0];

  useEffect(() => { headingRef.current?.focus(); }, []);

  return <div className="admin-workspace">
    <div className="page-intro">
      <div className="page-intro__text">
        <h1 ref={headingRef} tabIndex={-1}>Administração</h1>
        <p className="page-intro__hint">Autorizações locais do Sentinel. O backend valida cada operação.</p>
      </div>
    </div>
    {sections.length > 1 && <nav className="admin-sections" aria-label="Áreas da Administração">
      <ul>{sections.map((section) => <li key={section.id}>
        <button type="button" className={`toolbar-action ${section.id === active?.id ? "toolbar-action--active" : ""}`}
          aria-current={section.id === active?.id ? "page" : undefined} onClick={() => setRequested(section.id)}>{section.label}</button>
      </li>)}</ul>
    </nav>}
    {active?.id === "users" && <UsersAdmin currentUserId={currentUserId} onSelfChanged={onSelfChanged} />}
  </div>;
}
