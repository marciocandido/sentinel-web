import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import {
  adminCatalog,
  adminUser,
  CREATED_USER_ID,
  inactiveUser,
  INACTIVE_USER_ID,
  OTHER_USER_ID,
  selfAdminUser,
  userPage,
} from "../../test/adminFixtures";
import { anonymousSession, authenticatedSession, setCsrfCookie, TEST_USER_ID } from "../../test/authFixtures";
import { runtimeStatus } from "../../test/runtimeFixtures";

type Handler = (init: RequestInit, url: URL) => Promise<Response>;

const fetchMock = vi.fn();
const segments = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
const CSRF = "csrf-admin-sessao";
let routes: Record<string, Handler>;

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: () => Promise.resolve(body) } as Response;
}
const ok = (body: unknown, status = 200): Handler => () => Promise.resolve(jsonResponse(body, status));
const noContent: Handler = () => Promise.resolve({ ok: true, status: 204, headers: new Headers(), json: () => Promise.reject(new SyntaxError("empty")) } as Response);
const apiError = (status: number, code: string): Handler => ok({ error: { code, message: `backend detail ${code}` } }, status);

/** Request pendente controlada pelo teste, rejeitando como o fetch real ao ser abortada. */
function deferred() {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  const handler: Handler = (init) => new Promise<Response>((done, reject) => {
    resolve = done;
    signal = init.signal ?? undefined;
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  });
  return { handler, resolve: (response: Response) => resolve(response), signal: () => signal };
}

function calls(method: string, path: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url = new URL(String(input), "http://localhost");
    return ((init as RequestInit | undefined)?.method ?? "GET") === method && url.pathname === path;
  }) as [string, RequestInit][];
}
const adminCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/v1/admin/"));
const csrfOf = (init: RequestInit) => (init.headers as Record<string, string>)["X-Sentinel-CSRF"];
const bodyOf = (init: RequestInit) => JSON.parse(String(init.body)) as unknown;

beforeEach(() => {
  setCsrfCookie(CSRF);
  routes = {
    "GET /api/v1/auth/session": ok(authenticatedSession()),
    "GET /api/v1/runtime/status": ok(runtimeStatus()),
    "GET /api/v1/catalog/segments": ok(segments),
    "POST /api/v1/auth/logout": noContent,
    "GET /api/v1/admin/capabilities": ok(adminCatalog),
    "GET /api/v1/admin/users": ok(userPage([inactiveUser(), selfAdminUser(), adminUser()])),
    [`GET /api/v1/admin/users/${OTHER_USER_ID}`]: ok(adminUser()),
    [`GET /api/v1/admin/users/${TEST_USER_ID}`]: ok(selfAdminUser()),
    [`GET /api/v1/admin/users/${INACTIVE_USER_ID}`]: ok(inactiveUser()),
  };
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const handler = routes[`${init.method ?? "GET"} ${url.pathname}`];
    return handler ? handler(init, url) : Promise.reject(new Error(`Unexpected request: ${init.method ?? "GET"} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfCookie(null);
  localStorage.clear();
  sessionStorage.clear();
});

async function openAdministration() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Administração" }));
  await screen.findByRole("heading", { level: 1, name: "Administração" });
  return screen.findByRole("table", { name: /Usuários do Sentinel/ });
}

async function openUser(name: string) {
  const table = await screen.findByRole("table", { name: /Usuários do Sentinel/ });
  fireEvent.click(within(table).getByRole("button", { name: `Gerenciar ${name}` }));
  const detail = (await screen.findByRole("heading", { level: 3, name: new RegExp(name) })).closest("section") as HTMLElement;
  await waitFor(() => expect(detail).toHaveAttribute("aria-busy", "false"));
  return detail;
}

describe("navegação da Administração por capability", () => {
  it("usuário sem sentinel:admin não vê Administração nem dispara requests administrativas", async () => {
    routes["GET /api/v1/auth/session"] = ok(authenticatedSession({ permissions: ["sentinel:access"] }));
    render(<App />);
    expect(await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Administração/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Usuários/)).not.toBeInTheDocument();
    expect(adminCalls()).toHaveLength(0);
  });

  it("a1:manage sozinho não abre a área Usuários neste corte", async () => {
    routes["GET /api/v1/auth/session"] = ok(authenticatedSession({ permissions: ["sentinel:access", "a1:manage"] }));
    render(<App />);
    expect(await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Administração/ })).not.toBeInTheDocument();
    expect(adminCalls()).toHaveLength(0);
  });

  it("admin abre Administração, com foco no título e sem requests antes de abrir", async () => {
    render(<App />);
    const nav = await screen.findByRole("button", { name: "Administração" });
    await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 });
    expect(adminCalls()).toHaveLength(0);
    fireEvent.click(nav);
    const heading = await screen.findByRole("heading", { level: 1, name: "Administração" });
    expect(heading).toHaveFocus();
    expect(nav).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Discovery" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { level: 2, name: "Usuários" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Áreas da Administração" })).not.toBeInTheDocument();
    await screen.findByRole("table", { name: /Usuários do Sentinel/ });
  });

  it("volta ao Discovery preservando o workspace montado", async () => {
    await openAdministration();
    expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discovery" }));
    expect(await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Administração" })).not.toBeInTheDocument();
    expect(calls("GET", "/api/v1/catalog/segments")).toHaveLength(1);
  });

  it("no mobile, escolher Administração fecha o drawer e foca o workspace", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByLabelText("Navegação principal")).toHaveClass("sidebar--mobile-open");
    fireEvent.click(screen.getByRole("button", { name: "Administração" }));
    expect(screen.getByLabelText("Navegação principal")).not.toHaveClass("sidebar--mobile-open");
    expect(screen.queryByRole("button", { name: "Fechar menu" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Administração" })).toHaveFocus());
    expect(screen.getByText("Administração", { selector: ".product-context" })).toBeInTheDocument();
  });
});

describe("lista de usuários", () => {
  it("mostra nome, login, situação textual e capabilities pelo catálogo, na ordem da API", async () => {
    const table = await openAdministration();
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "Usuário Antigoantigo.usuario",
      "Pessoa Operadora (você)operador",
      "Equipe Vendas Nortevendas.norte",
    ]);
    expect(within(rows[0]).getByText("Inativo")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Ativo")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Administração do Sentinel (catálogo)")).toBeInTheDocument();
    expect(within(table).queryByText("sentinel:admin")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(OTHER_USER_ID);
    expect(calls("GET", "/api/v1/admin/users")[0][0]).toBe("/api/v1/admin/users?limit=25&offset=0");
    expect(screen.queryByRole("navigation", { name: "Paginação de usuários" })).not.toBeInTheDocument();
  });

  it("mostra estado vazio explícito", async () => {
    routes["GET /api/v1/admin/users"] = ok(userPage([]));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Administração" }));
    expect(await screen.findByText("Nenhum usuário cadastrado.")).toBeInTheDocument();
  });

  it("pagina por limit/offset/has_more sem inventar total", async () => {
    routes["GET /api/v1/admin/users"] = (_init, url) => Promise.resolve(jsonResponse(url.searchParams.get("offset") === "0"
      ? userPage([adminUser()], { has_more: true })
      : userPage([inactiveUser()], { offset: 25 })));
    await openAdministration();
    const pagination = screen.getByRole("navigation", { name: "Paginação de usuários" });
    expect(within(pagination).getByText("Página 1 · usuários 1–1")).toBeInTheDocument();
    expect(within(pagination).getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(within(pagination).getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Usuário Antigo")).toBeInTheDocument();
    expect(calls("GET", "/api/v1/admin/users").at(-1)?.[0]).toBe("/api/v1/admin/users?limit=25&offset=25");
    expect(screen.getByText("Página 2 · usuários 26–26")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(document.body.textContent).not.toMatch(/de \d+ usuários|total/i);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("Equipe Vendas Norte")).toBeInTheDocument();
    expect(calls("GET", "/api/v1/admin/users").at(-1)?.[0]).toBe("/api/v1/admin/users?limit=25&offset=0");
  });

  it("HTTP 200 malformado mostra erro sanitizado, nunca lista vazia", async () => {
    routes["GET /api/v1/admin/users"] = ok({ items: [{ user_id: OTHER_USER_ID }], limit: 25, offset: 0, has_more: false });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Administração" }));
    expect(await screen.findByText("O Sentinel retornou uma resposta inesperada.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum usuário cadastrado.")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("401 numa leitura administrativa encerra a sessão pela fronteira existente", async () => {
    routes["GET /api/v1/admin/users"] = apiError(401, "session_expired");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Administração" }));
    expect(await screen.findByText("Sua sessão expirou. Entre novamente.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
  });
});

describe("criar usuário", () => {
  async function fillCreateForm(password = "senha-muito-segura", confirmation = password) {
    fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    const name = screen.getByLabelText("Nome");
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "  Nova Pessoa  " } });
    fireEvent.change(screen.getByLabelText("Usuário (login)"), { target: { value: "nova.pessoa" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: confirmation } });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));
  }

  it("cria com CSRF, recarrega a lista sem duplicar e devolve o foco", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let created = false;
    routes["POST /api/v1/admin/users"] = () => { created = true; return Promise.resolve(jsonResponse({ user_id: CREATED_USER_ID }, 201)); };
    routes["GET /api/v1/admin/users"] = () => Promise.resolve(jsonResponse(userPage(created
      ? [adminUser(), adminUser({ user_id: CREATED_USER_ID, login_name: "nova.pessoa", display_name: "Nova Pessoa" })]
      : [adminUser()])));
    await openAdministration();
    await fillCreateForm();

    expect(await screen.findByText("Usuário Nova Pessoa criado com acesso ao Sentinel.")).toBeInTheDocument();
    const [, init] = calls("POST", "/api/v1/admin/users")[0];
    expect(bodyOf(init)).toEqual({ login_name: "nova.pessoa", display_name: "Nova Pessoa", password: "senha-muito-segura" });
    expect(csrfOf(init)).toBe(CSRF);
    await waitFor(() => expect(screen.getAllByText("Nova Pessoa")).toHaveLength(1));
    expect(calls("GET", "/api/v1/admin/users")).toHaveLength(2);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Novo usuário" })).toHaveFocus());
    expect(document.body.innerHTML).not.toContain("senha-muito-segura");
    expect(JSON.stringify({ ...localStorage })).not.toContain("senha-muito-segura");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("senha-muito-segura");
    expect(log.mock.calls.flat().join(" ")).not.toContain("senha-muito-segura");
    log.mockRestore();
  });

  it("conflito de login mostra mensagem própria, limpa a senha e não expõe detalhe do backend", async () => {
    routes["POST /api/v1/admin/users"] = apiError(409, "user_conflict");
    await openAdministration();
    await fillCreateForm();
    expect(await screen.findByText("Já existe um usuário com esse login.")).toBeInTheDocument();
    expect(screen.queryByText(/backend detail/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Usuário (login)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Usuário (login)")).toHaveFocus();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar senha")).toHaveValue("");
    expect(screen.getByLabelText("Nome")).toHaveValue("  Nova Pessoa  ");
    expect(document.body.innerHTML).not.toContain("senha-muito-segura");
  });

  it("valida o mínimo vigente de 12 caracteres e a confirmação antes de enviar", async () => {
    await openAdministration();
    await fillCreateForm("curta");
    expect(screen.getByText("A senha precisa ter ao menos 12 caracteres.")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-muito-segura" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "outra-senha-longa" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));
    expect(screen.getByText("A confirmação não confere com a senha.")).toBeInTheDocument();
    expect(calls("POST", "/api/v1/admin/users")).toHaveLength(0);
  });

  it("Escape fecha o formulário e devolve o foco", async () => {
    await openAdministration();
    fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    fireEvent.keyDown(screen.getByLabelText("Nome"), { key: "Escape" });
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Novo usuário" })).toHaveFocus());
  });
});

describe("ativar e desativar acesso", () => {
  it("reativa sem confirmação e atualiza a linha na mesma posição", async () => {
    let reactivated = false;
    routes[`PATCH /api/v1/admin/users/${INACTIVE_USER_ID}/access`] = () => { reactivated = true; return noContent({}, new URL("http://x")); };
    routes[`GET /api/v1/admin/users/${INACTIVE_USER_ID}`] = () => Promise.resolve(jsonResponse(inactiveUser({ active: reactivated })));
    await openAdministration();
    const detail = await openUser("Usuário Antigo");
    fireEvent.click(within(detail).getByRole("button", { name: "Reativar acesso" }));
    expect(await within(detail).findByText("Acesso de Usuário Antigo reativado.")).toBeInTheDocument();
    const [, init] = calls("PATCH", `/api/v1/admin/users/${INACTIVE_USER_ID}/access`)[0];
    expect(bodyOf(init)).toEqual({ active: true });
    expect(csrfOf(init)).toBe(CSRF);
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(within(firstRow).getByText("Ativo")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("desativar exige confirmação que explica o encerramento das sessões; Escape cancela", async () => {
    routes[`PATCH /api/v1/admin/users/${OTHER_USER_ID}/access`] = noContent;
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    const trigger = within(detail).getByRole("button", { name: "Desativar acesso" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "Desativar o acesso de Equipe Vendas Norte?" });
    expect(dialog).toHaveTextContent("Desativar o acesso encerra as sessões existentes desse usuário.");
    expect(dialog).toHaveTextContent("O usuário não é apagado");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(calls("PATCH", `/api/v1/admin/users/${OTHER_USER_ID}/access`)).toHaveLength(0);

    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Desativar acesso" }));
    await waitFor(() => expect(calls("PATCH", `/api/v1/admin/users/${OTHER_USER_ID}/access`)).toHaveLength(1));
    const [, init] = calls("PATCH", `/api/v1/admin/users/${OTHER_USER_ID}/access`)[0];
    expect(bodyOf(init)).toEqual({ active: false });
    expect(csrfOf(init)).toBe(CSRF);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

describe("capabilities", () => {
  it("usa o catálogo da API como autoridade de label, descrição e código", async () => {
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    const list = within(detail).getByRole("list", { name: "Capabilities" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(adminCatalog.length);
    expect(items[3]).toHaveTextContent("Relatórios (catálogo)");
    expect(items[3]).toHaveTextContent("Capability futura publicada pelo backend.");
    expect(items[3]).toHaveTextContent("reports:view");
    expect(items[0]).toHaveTextContent("Concedida");
    expect(items[2]).toHaveTextContent("Não concedida");
  });

  it("concede uma capability com CSRF e relê as permissões do usuário", async () => {
    let granted = false;
    routes[`POST /api/v1/admin/users/${OTHER_USER_ID}/permissions`] = () => { granted = true; return noContent({}, new URL("http://x")); };
    routes[`GET /api/v1/admin/users/${OTHER_USER_ID}/permissions`] = () => Promise.resolve(jsonResponse({
      user_id: OTHER_USER_ID, permissions: granted ? ["a1:manage", "sentinel:access"] : ["sentinel:access"],
    }));
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    const grant = within(detail).getByRole("button", { name: "Conceder Gestão A1 (catálogo)" });
    grant.focus();
    fireEvent.click(grant);
    expect(await within(detail).findByText("“Gestão A1 (catálogo)” concedida a Equipe Vendas Norte.")).toBeInTheDocument();
    await waitFor(() => expect(grant).toHaveFocus());
    const [, init] = calls("POST", `/api/v1/admin/users/${OTHER_USER_ID}/permissions`)[0];
    expect(bodyOf(init)).toEqual({ permission: "a1:manage" });
    expect(csrfOf(init)).toBe(CSRF);
    expect(within(detail).getByRole("button", { name: "Revogar Gestão A1 (catálogo)" })).toBeInTheDocument();
  });

  it("revoga capability de outro usuário sem confirmação quando não encerra sessão", async () => {
    routes[`GET /api/v1/admin/users/${OTHER_USER_ID}`] = ok(adminUser({ permissions: ["sentinel:access", "sentinel:admin"] }));
    routes[`DELETE /api/v1/admin/users/${OTHER_USER_ID}/permissions/sentinel%3Aadmin`] = noContent;
    routes[`GET /api/v1/admin/users/${OTHER_USER_ID}/permissions`] = ok({ user_id: OTHER_USER_ID, permissions: ["sentinel:access"] });
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    fireEvent.click(within(detail).getByRole("button", { name: "Revogar Administração do Sentinel (catálogo)" }));
    expect(await within(detail).findByText("“Administração do Sentinel (catálogo)” revogada de Equipe Vendas Norte.")).toBeInTheDocument();
    const [, init] = calls("DELETE", `/api/v1/admin/users/${OTHER_USER_ID}/permissions/sentinel%3Aadmin`)[0];
    expect(csrfOf(init)).toBe(CSRF);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("sentinel:admin não implica a1:manage: admin aparece sem A1 e concede só o solicitado", async () => {
    await openAdministration();
    const detail = await openUser("Pessoa Operadora");
    const items = within(within(detail).getByRole("list", { name: "Capabilities" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Concedida");
    expect(items[2]).toHaveTextContent("Gestão A1 (catálogo)");
    expect(items[2]).toHaveTextContent("Não concedida");
    expect(within(items[2]).getByRole("button", { name: "Conceder Gestão A1 (catálogo)" })).toBeInTheDocument();
  });

  it("revogar sentinel:access de outro usuário pede confirmação sobre as sessões", async () => {
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    fireEvent.click(within(detail).getByRole("button", { name: "Revogar Acesso ao Sentinel (catálogo)" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("as sessões existentes desse usuário são encerradas");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(calls("DELETE", `/api/v1/admin/users/${OTHER_USER_ID}/permissions/sentinel%3Aaccess`)).toHaveLength(0);
  });

  it("403 de uma operação fica local e não derruba a sessão", async () => {
    routes[`POST /api/v1/admin/users/${OTHER_USER_ID}/permissions`] = apiError(403, "permission_denied");
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    fireEvent.click(within(detail).getByRole("button", { name: "Conceder Gestão A1 (catálogo)" }));
    expect(await within(detail).findByText("Sua conta não tem permissão para esta operação administrativa.")).toBeInTheDocument();
    expect(screen.queryByText(/backend detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Administração" })).toBeInTheDocument();
  });

  it("conflito de permissão mostra mensagem mapeada e reconcilia o usuário", async () => {
    routes[`POST /api/v1/admin/users/${OTHER_USER_ID}/permissions`] = apiError(409, "permission_conflict");
    await openAdministration();
    const detail = await openUser("Equipe Vendas Norte");
    fireEvent.click(within(detail).getByRole("button", { name: "Conceder Gestão A1 (catálogo)" }));
    expect(await within(detail).findByText(/A capability já estava concedida/)).toBeInTheDocument();
    await waitFor(() => expect(calls("GET", `/api/v1/admin/users/${OTHER_USER_ID}`)).toHaveLength(2));
  });
});

describe("alterações no próprio usuário", () => {
  it("revogar o próprio sentinel:admin exige confirmação forte e remove a Administração", async () => {
    routes[`DELETE /api/v1/admin/users/${TEST_USER_ID}/permissions/sentinel%3Aadmin`] = () => {
      routes["GET /api/v1/auth/session"] = ok(authenticatedSession({ permissions: ["sentinel:access"] }));
      return noContent({}, new URL("http://x"));
    };
    routes[`GET /api/v1/admin/users/${TEST_USER_ID}/permissions`] = ok({ user_id: TEST_USER_ID, permissions: ["sentinel:access"] });
    await openAdministration();
    const detail = await openUser("Pessoa Operadora");
    fireEvent.click(within(detail).getByRole("button", { name: "Revogar Administração do Sentinel (catálogo)" }));
    const dialog = screen.getByRole("alertdialog", { name: /Revogar o seu próprio/ });
    expect(dialog).toHaveTextContent("Você perderá imediatamente a área Usuários da Administração");
    const confirm = within(dialog).getByRole("button", { name: "Revogar minha capability" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Administração/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(calls("DELETE", `/api/v1/admin/users/${TEST_USER_ID}/permissions/sentinel%3Aadmin`)).toHaveLength(1);
  });

  it("revogar o próprio sentinel:access encerra a sessão e volta ao login sem erro", async () => {
    routes[`DELETE /api/v1/admin/users/${TEST_USER_ID}/permissions/sentinel%3Aaccess`] = () => {
      routes["GET /api/v1/auth/session"] = ok(anonymousSession);
      return noContent({}, new URL("http://x"));
    };
    await openAdministration();
    const detail = await openUser("Pessoa Operadora");
    fireEvent.click(within(detail).getByRole("button", { name: "Revogar Acesso ao Sentinel (catálogo)" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("A sua sessão atual será encerrada imediatamente");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Revogar meu acesso" }));

    expect(await screen.findByText("Sua sessão foi encerrada. Entre novamente.")).toBeInTheDocument();
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls("GET", `/api/v1/admin/users/${TEST_USER_ID}/permissions`)).toHaveLength(0);
  });

  it("desativar o próprio acesso exige confirmação forte e termina a sessão", async () => {
    routes[`PATCH /api/v1/admin/users/${TEST_USER_ID}/access`] = () => {
      routes["GET /api/v1/auth/session"] = ok(anonymousSession);
      return noContent({}, new URL("http://x"));
    };
    await openAdministration();
    const detail = await openUser("Pessoa Operadora");
    fireEvent.click(within(detail).getByRole("button", { name: "Desativar acesso" }));
    const dialog = screen.getByRole("alertdialog", { name: "Desativar o seu próprio acesso?" });
    expect(dialog).toHaveTextContent("Desativar o acesso encerra as sessões existentes desse usuário.");
    expect(within(dialog).getByRole("button", { name: "Desativar meu acesso" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Desativar meu acesso" }));
    expect(await screen.findByText("Sua sessão foi encerrada. Entre novamente.")).toBeInTheDocument();
  });
});

describe("isolamento entre sessões", () => {
  it("logout cancela requests administrativas pendentes", async () => {
    const pending = deferred();
    routes["GET /api/v1/admin/users"] = pending.handler;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Administração" }));
    await waitFor(() => expect(pending.signal()).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(pending.signal()?.aborted).toBe(true);
    expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
  });

  it("resposta atrasada da sessão anterior não alcança a sessão seguinte", async () => {
    let late!: (response: Response) => void;
    routes["GET /api/v1/admin/users"] = () => new Promise<Response>((resolve) => { late = resolve; });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Administração" }));
    await waitFor(() => expect(late).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    routes["POST /api/v1/auth/login"] = ok(authenticatedSession({ user_id: OTHER_USER_ID, display_name: "Equipe Vendas Norte", permissions: ["sentinel:access"] }));
    fireEvent.change(await screen.findByLabelText("Usuário"), { target: { value: "vendas.norte" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-local-segura" } });
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form") as HTMLFormElement);
    expect(await screen.findByRole("button", { name: "Buscar" }, { timeout: 4000 })).toBeEnabled();

    await act(async () => { late(jsonResponse(userPage([selfAdminUser()]))); await Promise.resolve(); });
    expect(screen.queryByText("Pessoa Operadora")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Administração/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
