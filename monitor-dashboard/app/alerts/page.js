"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL, fetchJSON, formatTime } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import Protected from "../../components/Protected";

export default function AlertsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJSON("/api/alerts?limit=200")
      .then(setRows)
      .catch((e) => setError(e.message));

    // prepend new alerts as they fire
    const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    socket.on("check:alert", (alert) => {
      setRows((prev) => [alert, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

  return (
    <Protected>
      <h1>Alerts</h1>
      <p className="muted">Failures that triggered an email notification.</p>

      {error && <p style={{ color: "#dc2626" }}>Could not load alerts: {error}</p>}

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
                No alerts sent yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id || i}>
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
