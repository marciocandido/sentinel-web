import { AuthBoundary } from "../features/auth/AuthBoundary";
import { AuthenticatedApp } from "./AuthenticatedApp";

export function App() {
  return <AuthBoundary app={AuthenticatedApp} />;
}
