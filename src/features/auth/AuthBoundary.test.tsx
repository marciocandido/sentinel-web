import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { anonymousSession, authenticatedSession, setCsrfCookie, TEST_USER_ID } from "../../test/authFixtures";
import { runtimeStatus } from "../../test/runtimeFixtures";
import { hasPermission } from "./authPresentation";

type Handler = (init: RequestInit) => Promise<Response>;

const fetchMock = vi.fn();
const catalog = { items: [{ id: "metal-mecanica", name: "Metal-mecânica" }] };
let routes: Record<string, Handler>;

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: () => Promise.resolve(body) } as Response;
}
const ok = (body: unknown, status = 200): Handler => () => Promise.resolve(jsonResponse(body, status));
const apiError = (status: number, code: string): Handler => ok({ error: { code, message: `backend detail ${code}` } }, status);
const offline: Handler = () => Promise.reject(new TypeError("private network detail"));

/** Request pendente controlada pelo teste, que rejeita como o fetch real ao ser abortada. */
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

function calls(path: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path) || String(url).includes(`${path}?`));
}

beforeEach(() => {
  routes = {
    "/api/v1/auth/session": ok(authenticatedSession()),
    "/api/v1/runtime/status": ok(runtimeStatus()),
    "/api/v1/catalog/segments": ok(catalog),
    "/api/v1/auth/logout": () => Promise.resolve({ ok: true, status: 204, headers: new Headers(), json: () => Promise.reject(new SyntaxError("empty")) } as Response),
  };
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const handler = routes[path];
    return handler ? handler(init) : Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

async function signIn(loginName = "operador", password = "senha-local-segura") {
  fireEvent.change(await screen.findByLabelText("Usuário"), { target: { value: loginName } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: password } });
  fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form") as HTMLFormElement);
}

describe("bootstrap da sessão", () => {
  it("não monta nada protegido enquanto verifica a sessão", () => {
    routes["/api/v1/auth/session"] = () => new Promise<Response>(() => undefined);
    render(<App />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Verificando acesso ao Sentinel…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Usuário")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/session");
  });

  it("abre o login sem sessão, com foco no usuário e sem shell", async () => {
    routes["/api/v1/auth/session"] = ok(anonymousSession);
    render(<App />);
    const login = await screen.findByLabelText("Usuário");
    await waitFor(() => expect(login).toHaveFocus());
    expect(login).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByText("Discovery Comercial")).toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
    expect(calls("/api/v1/runtime/status")).toHaveLength(0);
  });

  it("monta a aplicação com sessão válida e mostra só o nome exibível", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Buscar" })).toBeEnabled();
    expect(screen.getByText("Pessoa Operadora")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(TEST_USER_ID);
    expect(document.body.textContent).not.toContain("sentinel:admin");
    expect(screen.getByRole("button", { name: /Administração/ })).toBeDisabled();
  });

  it.each([
    ["authenticated sem campos", { authenticated: true }],
    ["anônimo com identidade", { ...anonymousSession, user_id: TEST_USER_ID }],
    ["campo extra", { ...authenticatedSession(), token: "x" }],
    ["user_id não UUID", authenticatedSession({ user_id: "1" })],
    ["active falso", { ...authenticatedSession(), active: false }],
  ])("trata HTTP 200 malformado (%s) como resposta inválida, nunca anônimo", async (_label, body) => {
    routes["/api/v1/auth/session"] = ok(body);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Não foi possível verificar o acesso" })).toBeInTheDocument();
    expect(screen.getByText("O Sentinel retornou uma resposta inesperada ao verificar a sessão.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Usuário")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
  });

  it.each([
    ["session_expired", "Sua sessão expirou. Entre novamente."],
    ["session_invalid", "Sua sessão foi encerrada. Entre novamente."],
  ])("leva 401 %s ao login", async (code, message) => {
    routes["/api/v1/auth/session"] = apiError(401, code);
    render(<App />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.queryByText(/backend detail/)).not.toBeInTheDocument();
  });

  it.each([
    ["access_disabled", "Seu acesso ao Sentinel está desativado. Procure um administrador do Sentinel."],
    ["permission_denied", "Sua conta não possui acesso ao Sentinel. Procure um administrador do Sentinel."],
  ])("mostra acesso negado para 403 %s, sem loop de login", async (code, message) => {
    routes["/api/v1/auth/session"] = apiError(403, code);
    render(<App />);
    const heading = await screen.findByRole("heading", { name: "Acesso não autorizado" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(calls("/api/v1/auth/session")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Entrar com outra conta" }));
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(calls("/api/v1/auth/session")).toHaveLength(1);
  });

  it("trata sessão sem sentinel:access como acesso negado", async () => {
    routes["/api/v1/auth/session"] = ok(authenticatedSession({ permissions: ["a1:manage"] }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Acesso não autorizado" })).toBeInTheDocument();
    expect(calls("/api/v1/runtime/status")).toHaveLength(0);
  });

  it.each([
    ["rede", offline, "Não foi possível conectar ao Sentinel. Verifique a conexão e tente novamente."],
    ["auth_unavailable", apiError(503, "auth_unavailable"), "O serviço de autenticação está temporariamente indisponível."],
  ])("oferece nova tentativa quando a verificação falha por %s", async (_label, handler, message) => {
    routes["/api/v1/auth/session"] = handler;
    render(<App />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    routes["/api/v1/auth/session"] = ok(authenticatedSession());
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Pessoa Operadora")).toBeInTheDocument();
    expect(calls("/api/v1/auth/session")).toHaveLength(2);
  });
});

describe("login", () => {
  beforeEach(() => {
    routes["/api/v1/auth/session"] = ok(anonymousSession);
    setCsrfCookie(null);
  });

  it("envia JSON estrito com X-Sentinel-CSRF: login e abre a aplicação", async () => {
    routes["/api/v1/auth/login"] = ok(authenticatedSession({ display_name: "Pessoa B" }));
    render(<App />);
    await signIn(" operador ", "senha-local-segura");
    expect(await screen.findByText("Pessoa B")).toBeInTheDocument();
    const [url, init] = calls("/api/v1/auth/login")[0];
    expect(String(url)).toBe("/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("login");
    expect(JSON.parse(init.body as string)).toEqual({ login_name: "operador", password: "senha-local-segura" });
    expect(String(url)).not.toContain("senha");
  });

  it.each([
    ["invalid_credentials", 401, "Usuário ou senha inválidos."],
    ["access_disabled", 403, "Seu acesso ao Sentinel está desativado."],
    ["permission_denied", 403, "Sua conta não possui acesso ao Sentinel."],
    ["login_limited", 429, "Muitas tentativas de acesso. Tente novamente mais tarde."],
    ["auth_unavailable", 503, "O serviço de autenticação está temporariamente indisponível."],
    ["unexpected_code", 500, "Não foi possível entrar agora. Tente novamente."],
  ])("mapeia %s para mensagem sanitizada", async (code, status, message) => {
    routes["/api/v1/auth/login"] = apiError(status, code);
    render(<App />);
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/backend detail/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
    const focused = code === "invalid_credentials" ? "Senha" : "Usuário";
    await waitFor(() => expect(screen.getByLabelText(focused)).toHaveFocus());
  });

  it("marca os campos, associa a mensagem e foca a senha após credencial inválida", async () => {
    routes["/api/v1/auth/login"] = apiError(401, "invalid_credentials");
    render(<App />);
    await signIn();
    await screen.findByRole("alert");
    const password = screen.getByLabelText("Senha");
    await waitFor(() => expect(password).toHaveFocus());
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Usuário")).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Usuário ou senha inválidos.");
  });

  it("oferece nova tentativa em falha de rede e timeout sem sair do formulário", async () => {
    routes["/api/v1/auth/login"] = offline;
    render(<App />);
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao Sentinel. Verifique a conexão e tente novamente.");
    expect(screen.queryByText("private network detail")).not.toBeInTheDocument();
    routes["/api/v1/auth/login"] = ok(authenticatedSession());
    await signIn();
    expect(await screen.findByText("Pessoa Operadora")).toBeInTheDocument();
  });

  it("valida campos vazios localmente sem chamar a API", async () => {
    render(<App />);
    await screen.findByLabelText("Usuário");
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form") as HTMLFormElement);
    expect(screen.getByLabelText("Usuário")).toHaveFocus();
    expect(screen.getByLabelText("Usuário")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o usuário.");
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: "operador" } });
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form") as HTMLFormElement);
    expect(screen.getByLabelText("Senha")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Informe a senha.");
    expect(calls("/api/v1/auth/login")).toHaveLength(0);
  });

  it("mostra carregamento e impede envio duplicado", async () => {
    const pending = deferred();
    routes["/api/v1/auth/login"] = pending.handler;
    render(<App />);
    await signIn();
    const button = screen.getByRole("button", { name: "Entrando…" });
    expect(button).toBeDisabled();
    expect(button.closest("form")).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    fireEvent.click(button);
    expect(calls("/api/v1/auth/login")).toHaveLength(1);
    await act(async () => pending.resolve(jsonResponse(authenticatedSession())));
    expect(await screen.findByText("Pessoa Operadora")).toBeInTheDocument();
  });

  it("não persiste senha nem expõe credenciais no navegador", async () => {
    const log = vi.spyOn(console, "log");
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    routes["/api/v1/auth/login"] = apiError(401, "invalid_credentials");
    render(<App />);
    await signIn("operador", "senha-muito-secreta");
    await screen.findByRole("alert");
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie;
    expect(stored).not.toContain("senha-muito-secreta");
    expect(document.body.innerHTML).not.toContain("senha-muito-secreta");
    for (const spy of [log, warn, error]) expect(JSON.stringify(spy.mock.calls)).not.toContain("senha-muito-secreta");
    vi.restoreAllMocks();
  });

  it("orienta a recarregar quando o backend já tem sessão ativa (409)", async () => {
    routes["/api/v1/auth/login"] = apiError(409, "already_authenticated");
    render(<App />);
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma sessão ativa neste navegador. Recarregue a página para continuar.");
  });
});

describe("logout e isolamento de sessão", () => {
  it("envia logout com o CSRF vigente, desmonta a aplicação e volta ao login", async () => {
    setCsrfCookie("csrf-da-sessao");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    const login = await screen.findByLabelText("Usuário");
    await waitFor(() => expect(login).toHaveFocus());
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
    expect(screen.queryByText("Pessoa Operadora")).not.toBeInTheDocument();
    const [, init] = calls("/api/v1/auth/logout")[0];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("csrf-da-sessao");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["session_expired", apiError(401, "session_expired")],
    ["session_invalid", apiError(401, "session_invalid")],
  ])("termina no login mesmo quando o logout responde %s", async (_code, handler) => {
    routes["/api/v1/auth/logout"] = handler;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("termina no login com aviso quando a saída não pode ser confirmada", async () => {
    routes["/api/v1/auth/logout"] = offline;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível confirmar a saída no servidor.");
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(calls("/api/v1/auth/logout")).toHaveLength(1);
  });

  it("cancela requests protegidas e impede que resposta atrasada de A alcance B", async () => {
    const lateRuntime = deferred();
    routes["/api/v1/runtime/status"] = lateRuntime.handler;
    render(<App />);
    await screen.findByText("Pessoa Operadora");
    await waitFor(() => expect(lateRuntime.signal()).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(lateRuntime.signal()?.aborted).toBe(true);
    await screen.findByLabelText("Usuário");

    routes["/api/v1/runtime/status"] = ok(runtimeStatus());
    routes["/api/v1/auth/login"] = ok(authenticatedSession({ display_name: "Pessoa B", user_id: "9b2f6c1e-3d4a-4e5f-8a9b-0c1d2e3f4a5b" }));
    await signIn("pessoa-b");
    expect(await screen.findByRole("button", { name: "Buscar" })).toBeEnabled();

    const processing = runtimeStatus({ base: { state: "PROCESSING", preparing_competence: "2099-01", current_stage: "BUILD_BASE_UTIL" } });
    await act(async () => lateRuntime.resolve(jsonResponse(processing)));
    expect(screen.getByText("Pessoa B")).toBeInTheDocument();
    expect(screen.queryByText("Pessoa Operadora")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparando base da Receita")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
  });

  it("volta ao login quando uma request protegida revela sessão expirada", async () => {
    routes["/api/v1/runtime/status"] = apiError(401, "session_expired");
    render(<App />);
    expect(await screen.findByText("Sua sessão expirou. Entre novamente.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();
  });

  it("mostra acesso negado quando uma request protegida revela acesso desativado", async () => {
    routes["/api/v1/runtime/status"] = apiError(403, "access_disabled");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Acesso não autorizado" })).toBeInTheDocument();
  });
});

describe("capabilities na interface", () => {
  it("não oferece preparação da base nem consulta preflight administrativo para usuário comum", async () => {
    routes["/api/v1/auth/session"] = ok(authenticatedSession({ permissions: ["sentinel:access"] }));
    routes["/api/v1/runtime/status"] = ok(runtimeStatus({ base: { state: "AWAITING_OPERATOR", active_competence: null } }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Base da Receita ainda não preparada" })).toBeInTheDocument();
    expect(screen.getByText("A preparação da base é feita por um administrador do Sentinel.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/v1/base/"))).toBe(false);
  });

  it("não mostra atualização mensal para usuário comum com Discovery disponível", async () => {
    routes["/api/v1/auth/session"] = ok(authenticatedSession({ permissions: ["sentinel:access"] }));
    routes["/api/v1/runtime/status"] = ok(runtimeStatus({ base: { available_competence: "2026-08" } }));
    render(<App />);
    expect(await screen.findByRole("button", { name: "Buscar" })).toBeEnabled();
    const workspace = document.getElementById("app-content") as HTMLElement;
    expect(within(workspace).queryByText(/2026-08|08\/2026/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/v1/base/"))).toBe(false);
  });

  it("sentinel:admin não implica a1:manage", () => {
    const admin = authenticatedSession({ permissions: ["sentinel:access", "sentinel:admin"] });
    expect(hasPermission(admin, "sentinel:admin")).toBe(true);
    expect(hasPermission(admin, "a1:manage")).toBe(false);
    expect(hasPermission(authenticatedSession({ permissions: ["sentinel:access", "a1:manage"] }), "sentinel:admin")).toBe(false);
  });
});
