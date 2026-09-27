import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { setCsrfCookie } from "./authFixtures";

// Por padrão os testes rodam como sessão autenticada, com o cookie CSRF que o
// backend emite no login HTTP local; testes de auth ajustam isso explicitamente.
beforeEach(() => {
  setCsrfCookie("csrf-test-token");
});

afterEach(() => {
  cleanup();
  setCsrfCookie(null);
});
