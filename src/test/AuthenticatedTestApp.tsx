import { AuthenticatedApp } from "../app/AuthenticatedApp";
import type { AuthenticatedSessionResponse } from "../types/api";
import { authenticatedSession } from "./authFixtures";

/** Subtree protegido já autenticado, para testes de Discovery/runtime. */
export function AuthenticatedTestApp({ session = authenticatedSession(), onSignOut = () => undefined }: {
  session?: AuthenticatedSessionResponse;
  onSignOut?: () => void;
}) {
  return <AuthenticatedApp session={session} onSignOut={onSignOut} />;
}
