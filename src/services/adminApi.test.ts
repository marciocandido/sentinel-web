import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminCatalog, adminUser, OTHER_USER_ID, userPage } from "../test/adminFixtures";
import { setCsrfCookie } from "../test/authFixtures";
import {
  createUser,
  getUser,
  getUserPermissions,
  grantPermission,
  listCapabilities,
  listUsers,
  revokePermission,
  setUserAccess,
} from "./adminApi";
import { patchJson, SentinelApiError } from "./apiClient";

const fetchMock = vi.fn();

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => (body === undefined ? Promise.reject(new SyntaxError("empty")) : Promise.resolve(body)),
  } as Response;
}

function lastCall(): [string, RequestInit] {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return [String(url), init];
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setCsrfCookie("csrf-admin-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfCookie(null);
});

describe("adminApi — leitura", () => {
  it("consome o catálogo e a lista na ordem da API, com limit/offset no query string", async () => {
    fetchMock.mockResolvedValueOnce(response(adminCatalog));
    expect(await listCapabilities()).toEqual(adminCatalog);
    expect(lastCall()[0]).toBe("/api/v1/admin/capabilities");

    const page = userPage([adminUser({ login_name: "zeta" }), adminUser({ user_id: "16fd2706-8baf-433b-82eb-8c7fada847da", login_name: "alfa" })], { offset: 25, has_more: true });
    fetchMock.mockResolvedValueOnce(response(page));
    const result = await listUsers({ limit: 25, offset: 25 });
    expect(result.items.map((user) => user.login_name)).toEqual(["zeta", "alfa"]);
    expect(result).not.toHaveProperty("total");
    const [url, init] = lastCall();
    expect(url).toBe("/api/v1/admin/users?limit=25&offset=25");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
  });

  it.each([
    ["lista sem has_more", { items: [], limit: 25, offset: 0 }],
    ["lista com item sem permissions", { items: [{ ...adminUser(), permissions: undefined }], limit: 25, offset: 0, has_more: false }],
    ["lista com timestamp inválido", userPage([adminUser({ created_at: "ontem" })])],
    ["lista com user_id não UUID", userPage([adminUser({ user_id: "1" })])],
    ["lista com mais itens que o limit", userPage([adminUser(), adminUser()], { limit: 1 })],
    ["objeto no lugar da lista", {}],
  ])("rejeita 200 malformado como invalid_response: %s", async (_label, body) => {
    fetchMock.mockResolvedValueOnce(response(body));
    await expect(listUsers({ limit: 25, offset: 0 })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejeita catálogo malformado e detalhe/permissões inconsistentes", async () => {
    fetchMock.mockResolvedValueOnce(response([{ code: "sentinel:access" }]));
    await expect(listCapabilities()).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockResolvedValueOnce(response({ ...adminUser(), active: "sim" }));
    await expect(getUser(OTHER_USER_ID)).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockResolvedValueOnce(response({ user_id: "16fd2706-8baf-433b-82eb-8c7fada847da", permissions: [] }));
    await expect(getUserPermissions(OTHER_USER_ID)).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("lê detalhe e permissões pelos endpoints do usuário", async () => {
    fetchMock.mockResolvedValueOnce(response(adminUser()));
    await getUser(OTHER_USER_ID);
    expect(lastCall()[0]).toBe(`/api/v1/admin/users/${OTHER_USER_ID}`);
    fetchMock.mockResolvedValueOnce(response({ user_id: OTHER_USER_ID, permissions: ["a1:manage", "sentinel:access"] }));
    expect((await getUserPermissions(OTHER_USER_ID)).permissions).toEqual(["a1:manage", "sentinel:access"]);
    expect(lastCall()[0]).toBe(`/api/v1/admin/users/${OTHER_USER_ID}/permissions`);
  });
});

describe("adminApi — mutações com CSRF centralizado", () => {
  it("cria usuário com o corpo estrito e aceita somente 201", async () => {
    fetchMock.mockResolvedValueOnce(response({ user_id: OTHER_USER_ID }, 201));
    await expect(createUser({ loginName: "novo", displayName: "Novo", password: "senha-bem-longa" })).resolves.toEqual({ user_id: OTHER_USER_ID });
    const [url, init] = lastCall();
    expect(url).toBe("/api/v1/admin/users");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ login_name: "novo", display_name: "Novo", password: "senha-bem-longa" });
    expect((init.headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("csrf-admin-token");

    fetchMock.mockResolvedValueOnce(response({ user_id: "x" }, 201));
    await expect(createUser({ loginName: "novo", displayName: "Novo", password: "senha-bem-longa" })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("altera acesso por PATCH com as mesmas garantias de POST", async () => {
    fetchMock.mockResolvedValueOnce(response(undefined, 204));
    await setUserAccess(OTHER_USER_ID, false);
    const [url, init] = lastCall();
    expect(url).toBe(`/api/v1/admin/users/${OTHER_USER_ID}/access`);
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("same-origin");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({ active: false });
    expect((init.headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("csrf-admin-token");
  });

  it("PATCH descarta CSRF vindo da feature e falha sem cookie CSRF sem chamar a rede", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 200));
    await patchJson("/api/v1/example", {}, { headers: { "x-sentinel-csrf": "forjado" } });
    expect((lastCall()[1].headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("csrf-admin-token");
    expect(Object.keys(lastCall()[1].headers as Record<string, string>)).not.toContain("x-sentinel-csrf");

    fetchMock.mockClear();
    setCsrfCookie(null);
    await expect(setUserAccess(OTHER_USER_ID, true)).rejects.toMatchObject({ code: "csrf_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("concede e revoga uma capability por vez, sem hierarquia", async () => {
    fetchMock.mockResolvedValueOnce(response(undefined, 204));
    await grantPermission(OTHER_USER_ID, "a1:manage");
    let [url, init] = lastCall();
    expect(url).toBe(`/api/v1/admin/users/${OTHER_USER_ID}/permissions`);
    expect(JSON.parse(String(init.body))).toEqual({ permission: "a1:manage" });
    expect((init.headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("csrf-admin-token");

    fetchMock.mockResolvedValueOnce(response(undefined, 204));
    await revokePermission(OTHER_USER_ID, "sentinel:admin");
    [url, init] = lastCall();
    expect(url).toBe(`/api/v1/admin/users/${OTHER_USER_ID}/permissions/sentinel%3Aadmin`);
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>)["X-Sentinel-CSRF"]).toBe("csrf-admin-token");
  });

  it("preserva o código de erro do backend sem depender da mensagem", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: { code: "permission_conflict", message: "detalhe interno" } }, 409));
    const failure = await grantPermission(OTHER_USER_ID, "a1:manage").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SentinelApiError);
    expect(failure).toMatchObject({ code: "permission_conflict", status: 409 });
  });
});
