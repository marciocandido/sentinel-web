type IconName = "discovery" | "companies" | "lists" | "admin";

function NavigationIcon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", "aria-hidden": true };

  if (name === "discovery") {
    return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  }
  if (name === "companies") {
    return <svg {...common}><path d="M3 21h18M5 21V5l7-3v19M19 21V9l-7-3M8 8h1M8 12h1M15 12h1M15 16h1" /></svg>;
  }
  if (name === "lists") {
    return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.54V20h-3v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.08 15a1.7 1.7 0 0 0-1.54-1H5v-3h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.35 5.94l.06.06A1.7 1.7 0 0 0 10.29 6.4a1.7 1.7 0 0 0 1-1.54V5h3v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 10.29a1.7 1.7 0 0 0 1.54 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
}

const navigation = [
  { label: "Discovery", icon: "discovery" as const, current: true },
  { label: "Empresas", icon: "companies" as const, current: false },
  { label: "Listas", icon: "lists" as const, current: false },
  { label: "Administração", icon: "admin" as const, current: false },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="brand-mark" aria-hidden="true">S</div>
      <nav>
        <ul className="sidebar-nav">
          {navigation.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={`nav-item ${item.current ? "nav-item--active" : ""}`}
                aria-current={item.current ? "page" : undefined}
                disabled={!item.current}
              >
                <NavigationIcon name={item.icon} />
                <span>{item.label}</span>
                {!item.current && <span className="future-label">Em breve</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
