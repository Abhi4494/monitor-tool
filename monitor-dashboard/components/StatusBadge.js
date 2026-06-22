import { statusColor } from "../lib/api";

export default function StatusBadge({ status }) {
  return (
    <span className="badge" style={{ background: statusColor(status) }}>
      {status}
    </span>
  );
}
