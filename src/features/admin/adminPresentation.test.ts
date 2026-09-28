import { describe, expect, it } from "vitest";
import { SentinelApiError } from "../../services/apiClient";
import { adminErrorMessage, isAborted, selfRevokeImpact } from "./adminPresentation";

describe("adminPresentation", () => {
  it.each([
    "user_conflict", "user_not_found", "permission_conflict", "permission_not_found", "unknown_capability",
    "auth_data_invalid", "auth_unavailable", "permission_denied", "invalid_request", "csrf_invalid",
  ])("mapeia %s para mensagem própria, sem repassar a mensagem do backend", (code) => {
    const message = adminErrorMessage(new SentinelApiError(code, "detalhe privado do backend", 400));
    expect(message).not.toContain("detalhe privado");
    expect(message).not.toBe(adminErrorMessage(new SentinelApiError("codigo_desconhecido", "x")));
  });

  it("usa mensagem genérica para código desconhecido e trata cancelamento à parte", () => {
    expect(adminErrorMessage(new SentinelApiError("codigo_desconhecido", "segredo"))).toBe("Não foi possível concluir a operação agora. Tente novamente.");
    expect(adminErrorMessage(new Error("stack"))).toContain("conectar");
    expect(isAborted(new SentinelApiError("request_aborted", "x"))).toBe(true);
  });

  it("classifica a auto-revogação sem hierarquia entre capabilities", () => {
    expect(selfRevokeImpact("sentinel:access")).toBe("ends_session");
    expect(selfRevokeImpact("sentinel:admin")).toBe("loses_admin_area");
    expect(selfRevokeImpact("a1:manage")).toBeNull();
  });
});
