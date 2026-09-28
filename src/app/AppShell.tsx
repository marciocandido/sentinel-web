import { LogOut, Menu } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sidebar, type Destination } from "../components/Sidebar";
import type { RuntimeLifecycleView } from "../features/runtime/runtimeTypes";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

const DESTINATION_CONTEXT: Readonly<Record<Destination, string>> = { discovery: "Discovery Comercial", administration: "Administração" };

export function AppShell({ children, runtime, identity, onSignOut, destination, availableDestinations, onNavigate }: {
  children: ReactNode;
  runtime: RuntimeLifecycleView;
  identity: string;
  onSignOut: () => void;
  destination: Destination;
  availableDestinations: readonly Destination[];
  onNavigate: (destination: Destination) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocusTarget = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); return; }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); returnFocusTarget?.focus(); };
  }, [menuOpen]);
  return <div className="app-shell">
    {menuOpen && <button className="mobile-menu-overlay" type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <Sidebar runtime={runtime} mobileOpen={menuOpen} drawerRef={drawerRef} current={destination} available={availableDestinations} onNavigate={(next) => { setMenuOpen(false); onNavigate(next); }} />
    <div className="app-content" id="app-content" inert={menuOpen ? true : undefined}>
      <header className="app-header">
        <button ref={menuButtonRef} className="mobile-menu-button" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(true)}><Menu aria-hidden="true" size={20} /></button>
        <div className="app-header__product"><p className="product-name">Sentinel</p><p className="product-context">{DESTINATION_CONTEXT[destination]}</p></div>
        <div className="session-identity">
          <span className="session-identity__name" title={identity}>{identity}</span>
          <button className="session-identity__signout" type="button" onClick={onSignOut}><LogOut aria-hidden="true" size={16} /><span>Sair</span></button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  </div>;
}
