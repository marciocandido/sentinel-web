import { useEffect, useState } from "react";
import { getLiveness } from "../services/sentinelApi";

type ApiStatusState = "checking" | "online" | "offline";

const labels: Record<ApiStatusState, string> = {
  checking: "Verificando",
  online: "Online",
  offline: "Indisponível",
};

export function ApiStatus() {
  const [status, setStatus] = useState<ApiStatusState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    void getLiveness({ signal: controller.signal })
      .then(() => {
        if (mounted) setStatus("online");
      })
      .catch(() => {
        if (mounted && !controller.signal.aborted) setStatus("offline");
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <p className={`api-status api-status--${status}`} aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <span>API: {labels[status]}</span>
    </p>
  );
}
