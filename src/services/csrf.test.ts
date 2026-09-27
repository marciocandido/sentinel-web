import { describe, expect, it } from "vitest";
import { csrfCookieName, readCsrfToken } from "./csrf";

describe("readCsrfToken", () => {
  it("lê __Host-sentinel_csrf sob HTTPS e ignora o nome sem prefixo", () => {
    expect(csrfCookieName("https:")).toBe("__Host-sentinel_csrf");
    expect(readCsrfToken("__Host-sentinel_csrf=secure-token; other=1", "https:")).toBe("secure-token");
    expect(readCsrfToken("sentinel_csrf=local-token", "https:")).toBeNull();
  });

  it("lê sentinel_csrf no HTTP local", () => {
    expect(csrfCookieName("http:")).toBe("sentinel_csrf");
    expect(readCsrfToken("a=1; sentinel_csrf=local-token ; b=2", "http:")).toBe("local-token");
  });

  it("nunca devolve o cookie de sessão nem valores vazios ou por prefixo parcial", () => {
    const cookies = "sentinel_session=session-secret; __Host-sentinel_session=secure-secret; xsentinel_csrf=wrong";
    expect(readCsrfToken(cookies, "http:")).toBeNull();
    expect(readCsrfToken(cookies, "https:")).toBeNull();
    expect(readCsrfToken("sentinel_csrf=", "http:")).toBeNull();
    expect(readCsrfToken("", "http:")).toBeNull();
  });

  it("usa document.cookie e o protocolo da página por padrão", () => {
    document.cookie = "sentinel_csrf=from-document; path=/";
    expect(readCsrfToken()).toBe("from-document");
  });
});
