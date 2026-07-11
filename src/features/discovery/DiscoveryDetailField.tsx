import type { ReactNode } from "react";

interface DiscoveryDetailFieldProps {
  label: string;
  value: ReactNode;
  code?: boolean;
}

export function DiscoveryDetailField({ label, value, code = false }: DiscoveryDetailFieldProps) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd className={code ? "detail-field__code" : undefined}>{value}</dd>
    </div>
  );
}
