import type { ReactNode } from "react";
import { ApiStatus } from "../components/ApiStatus";
import { Sidebar } from "../components/Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <header className="app-header">
          <div>
            <p className="product-name">Sentinel</p>
            <p className="product-context">Discovery Comercial</p>
          </div>
          <ApiStatus />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
