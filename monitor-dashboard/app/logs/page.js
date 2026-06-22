"use client";

import { useEffect, useState } from "react";
import { fetchJSON, formatTime } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import Protected from "../../components/Protected";

export default function LogsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setRows(await fetchJSON("/api/logs?limit=200"));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // refresh history periodically
    return () => clearInterval(id);
  }, []);

  return (
    <Protected>
      <h1>Error Logs</h1>
      <p className="muted">Failed checks (DOWN / FAILED), most recent first.</p>

      {error && <p style={{ color: "#dc2626" }}>Could not load logs: {error}</p>}

      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Target</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No errors recorded. 🎉
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{formatTime(r.createdAt)}</td>
                <td>{r.name || "-"}</td>
                <td>{r.type}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className="muted">
                  <a className="url" href={r.target} target="_blank" rel="noreferrer">
                    {r.target}
                  </a>
                </td>
                <td className="msg">{r.message}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Protected>
  );
}
