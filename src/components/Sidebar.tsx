import { useState, type RefObject } from "react";
import { RuntimeHealthSidebar } from "../features/runtime/RuntimeHealthSidebar";
import type { RuntimeLifecycleView } from "../features/runtime/runtimeTypes";

type IconName = "discovery" | "companies" | "lists" | "admin";
function NavigationIcon({ name }: { name: IconName }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", "aria-hidden": true };
  if (name === "discovery") return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  if (name === "companies") return <svg {...common}><path d="M3 21h18M5 21V5l7-3v19M19 21V9l-7-3M8 8h1M8 12h1M15 12h1M15 16h1" /></svg>;
  if (name === "lists") return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.54V20h-3v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.08 15a1.7 1.7 0 0 0-1.54-1H5v-3h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.35 5.94l.06.06A1.7 1.7 0 0 0 10.29 6.4a1.7 1.7 0 0 0 1-1.54V5h3v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 10.29a1.7 1.7 0 0 0 1.54 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
}
export type Destination = "discovery" | "administration";
const navigation: readonly { label: string; icon: IconName; destination: Destination | null }[] = [
  { label: "Discovery", icon: "discovery", destination: "discovery" },
  { label: "Empresas", icon: "companies", destination: null },
  { label: "Listas", icon: "lists", destination: null },
  { label: "Administração", icon: "admin", destination: "administration" },
];

/**
 * O trilho fica compacto em repouso e expande temporariamente sobre o
 * workspace no desktop, por ponteiro ou foco de teclado. A expansão é apenas
 * visual: o conteúdo principal mantém a mesma largura e posição, e nada é
 * persistido. No mobile vale o drawer já existente.
 */
export function Sidebar({ runtime, mobileOpen, drawerRef, current, available, onNavigate }: {
  runtime: RuntimeLifecycleView;
  mobileOpen: boolean;
  drawerRef: RefObject<HTMLElement | null>;
  current: Destination;
  /** Destinos liberados para a sessão; um destino funcional fora da lista não é exibido. */
  available: readonly Destination[];
  onNavigate: (destination: Destination) => void;
}) {
  const items = navigation.filter((item) => item.destination === null || available.includes(item.destination));
  const [expanded, setExpanded] = useState(false);
  const collapse = () => setExpanded(false);
  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) collapse();
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") collapse();
  };
  return <aside
    ref={drawerRef}
    id="main-navigation"
    className={`sidebar ${expanded ? "sidebar--expanded" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`}
    data-expanded={expanded ? "true" : "false"}
    aria-label="Navegação principal"
    onMouseEnter={() => setExpanded(true)}
    onMouseLeave={collapse}
    onFocus={() => setExpanded(true)}
    onBlur={handleBlur}
    onKeyDown={handleKeyDown}
  >
    <div className="sidebar__brand"><span className="brand-mark" aria-hidden="true">S</span></div>
    <nav className="sidebar__nav"><ul className="sidebar-nav">{items.map((item) => {
      const active = item.destination === current;
      const future = item.destination === null;
      return <li key={item.label}><button type="button" className={`nav-item ${active ? "nav-item--active" : ""}`} title={future ? `${item.label} — em breve` : item.label} aria-current={active ? "page" : undefined} disabled={future} onClick={item.destination ? () => onNavigate(item.destination as Destination) : undefined}><NavigationIcon name={item.icon} /><span className="nav-item__label">{item.label}</span>{future && <span className="future-label">Em breve</span>}</button></li>;
    })}</ul></nav>
    <RuntimeHealthSidebar runtime={runtime} />
  </aside>;
}
