/**
 * Única leitura permitida de `document.cookie` no frontend: o token CSRF
 * legível emitido pelo backend no login (docs/api/12-human-auth.md). O cookie
 * de sessão é HttpOnly e nunca é lido, copiado ou persistido pelo navegador.
 *
 * HTTPS usa o prefixo `__Host-`; HTTP local (`SENTINEL_AUTH_COOKIE_SECURE=false`)
 * usa o nome sem prefixo. Sob HTTPS somente o nome `__Host-` é aceito.
 */
export const SECURE_CSRF_COOKIE = "__Host-sentinel_csrf";
export const LOCAL_CSRF_COOKIE = "sentinel_csrf";

export function csrfCookieName(protocol: string = window.location.protocol): string {
  return protocol === "https:" ? SECURE_CSRF_COOKIE : LOCAL_CSRF_COOKIE;
}

export function readCsrfToken(
  cookieHeader: string = document.cookie,
  protocol: string = window.location.protocol,
): string | null {
  const name = csrfCookieName(protocol);
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value ? value : null;
  }
  return null;
}
