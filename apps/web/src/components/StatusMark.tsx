import { Check, Clock3, LockKeyhole } from "lucide-react";

import type { EvidenceStatus } from "../domain/session";

interface StatusMarkProps {
  label: string;
  status: EvidenceStatus;
}

export function StatusMark({ label, status }: StatusMarkProps) {
  const Icon = status === "verified" ? Check : status === "pending" ? Clock3 : LockKeyhole;

  return (
    <span className={`status-mark status-mark-${status}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
      <span>{label}</span>
    </span>
  );
}
