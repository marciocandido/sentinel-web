import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { runtimeStatus } from "../test/runtimeFixtures";

const runtime = runtimeStatus();
const catalog = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => Promise.resolve(
    jsonResponse(input.toString().includes("/api/v1/runtime/status") ? runtime : catalog),
  ));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const sidebar = () => screen.getByLabelText("Navegação principal");
const workspace = () => document.getElementById("app-content") as HTMLElement;

describe("Sidebar compacta com expansão temporária", () => {
  it("fica compacta em repouso, com nomes acessíveis pelos ícones", async () => {
    render(<App />);
    expect(sidebar()).toHaveAttribute("data-expanded", "false");
    expect(sidebar()).not.toHaveClass("sidebar--expanded");
    expect(await screen.findByRole("button", { name: "Discovery" })).toHaveAttribute("title", "Discovery");
    expect(within(sidebar()).getByText("API")).toBeInTheDocument();
  });

  it("expande no hover e recolhe ao sair com o ponteiro", () => {
    render(<App />);
    fireEvent.mouseEnter(sidebar());
    expect(sidebar()).toHaveAttribute("data-expanded", "true");
    expect(sidebar()).toHaveClass("sidebar--expanded");
    fireEvent.mouseLeave(sidebar());
    expect(sidebar()).toHaveAttribute("data-expanded", "false");
  });

  it("expande quando a navegação recebe foco de teclado e recolhe ao sair", () => {
    render(<App />);
    const discovery = screen.getByRole("button", { name: "Discovery" });
    discovery.focus();
    fireEvent.focus(discovery);
    expect(discovery).toHaveFocus();
    expect(sidebar()).toHaveAttribute("data-expanded", "true");

    const outside = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.blur(discovery, { relatedTarget: outside });
    expect(sidebar()).toHaveAttribute("data-expanded", "false");
  });

  it("mantém expandida quando o foco anda entre itens do próprio trilho", () => {
    render(<App />);
    const discovery = screen.getByRole("button", { name: "Discovery" });
    const health = within(sidebar()).getByText("API");
    fireEvent.focus(discovery);
    fireEvent.blur(discovery, { relatedTarget: health });
    expect(sidebar()).toHaveAttribute("data-expanded", "true");
  });

  it("recolhe com Escape sem quebrar a navegação", () => {
    render(<App />);
    fireEvent.mouseEnter(sidebar());
    expect(sidebar()).toHaveAttribute("data-expanded", "true");
    fireEvent.keyDown(sidebar(), { key: "Escape" });
    expect(sidebar()).toHaveAttribute("data-expanded", "false");
    expect(screen.getByRole("button", { name: "Discovery" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Empresas/ })).toBeDisabled();
  });

  it("não move nem redimensiona o workspace ao expandir", () => {
    render(<App />);
    const before = { className: workspace().className, style: workspace().getAttribute("style"), inert: workspace().hasAttribute("inert") };
    fireEvent.mouseEnter(sidebar());
    expect(workspace().className).toBe(before.className);
    expect(workspace().getAttribute("style")).toBe(before.style);
    expect(workspace().hasAttribute("inert")).toBe(before.inert);
    expect(sidebar().contains(workspace())).toBe(false);
  });

  it("mantém API, Banco e Worker no rodapé nos dois estados", () => {
    render(<App />);
    const health = within(sidebar()).getByLabelText("Saúde operacional");
    expect(sidebar().lastElementChild).toBe(health);
    for (const label of ["API", "Banco", "Worker"]) {
      expect(within(health).getByText(label)).toBeInTheDocument();
    }
    fireEvent.mouseEnter(sidebar());
    expect(sidebar().lastElementChild).toBe(health);
    for (const label of ["API", "Banco", "Worker"]) {
      expect(within(health).getByText(label)).toBeInTheDocument();
    }
  });

  it("não interfere no drawer mobile existente", () => {
    render(<App />);
    const menu = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(menu);
    expect(sidebar()).toHaveClass("sidebar--mobile-open");
    expect(workspace()).toHaveAttribute("inert");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(sidebar()).not.toHaveClass("sidebar--mobile-open");
    expect(menu).toHaveFocus();
    expect(screen.getAllByRole("button", { name: "Discovery" })).toHaveLength(1);
  });
});
