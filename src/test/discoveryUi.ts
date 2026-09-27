import { fireEvent, screen, within } from "@testing-library/react";
import { vi } from "vitest";

export type FamilyName = "Filtros" | "Proximidade" | "Estrutura";

/** Radiogroup principal com as três famílias. */
export function familyGroup(): HTMLElement {
  return screen.getByRole("radiogroup", { name: "Tipo de busca" });
}

export async function chooseFamily(name: FamilyName): Promise<void> {
  const group = await screen.findByRole("radiogroup", { name: "Tipo de busca" });
  fireEvent.click(within(group).getByRole("radio", { name }));
}

export async function chooseProximity(type: "Raio a partir de uma origem" | "Vizinhos de um CNPJ"): Promise<void> {
  await chooseFamily("Proximidade");
  fireEvent.click(screen.getByRole("radio", { name: type }));
}

export async function chooseStructure(type: "Raiz e filiais" | "Grupo comercial registrado"): Promise<void> {
  await chooseFamily("Estrutura");
  fireEvent.click(screen.getByRole("radio", { name: type }));
}

export function chooseRadiusOrigin(label: "Município" | "CNPJ" | "Código TOM" | "Código IBGE" | "Coordenadas"): void {
  const group = screen.getByRole("radiogroup", { name: "Origem" });
  fireEvent.click(within(group).getByRole("radio", { name: label }));
}

export function openMoreFilters(): void {
  const toggle = screen.getByRole("button", { name: /^Mais filtros/ });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

export function searchButton(): HTMLElement {
  return screen.getByRole("button", { name: /^(Buscar|Buscando\.\.\.)$/ });
}

export function clickSearch(): void {
  fireEvent.click(searchButton());
}

export function discoveryUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/v1/discovery/"));
}

/** Emula viewport estreita/larga para `matchMedia`, ausente no jsdom. */
export function stubViewport(narrow: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query.includes("max-width"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
