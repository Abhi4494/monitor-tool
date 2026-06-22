"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL, fetchJSON, statusColor, formatTime } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import Protected from "../components/Protected";

// One card per distinct target (a site can have several WEBSITE/API/BROWSER checks).
const keyOf = (r) => `${r.type}::${r.target}`;

export default function LiveStatusPage() {
  const [byTarget, setByTarget] = useState({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // initial snapshot from REST
    fetchJSON("/api/status")
      .then((rows) => {
        const map = {};
        for (const r of rows) map[keyOf(r)] = r;
        setByTarget(map);
      })
      .catch(() => {});

    // live updates over Socket.IO
    const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("check:result", (result) => {
      setByTarget((prev) => ({ ...prev, [keyOf(result)]: result }));
    });

    return () => socket.disconnect();
  }, []);

  const cards = Object.values(byTarget);

  return (
    <Protected>
      <h1>Live Status</h1>
      <p className="muted">
        <span
          className="dot"
          style={{ background: connected ? "#16a34a" : "#dc2626" }}
        />
        {connected ? "Connected to monitor server" : "Disconnected — retrying…"}
      </p>

      {cards.length === 0 ? (
        <p className="muted">Waiting for the first check cycle…</p>
      ) : (
        <div className="cards">
          {cards.map((c) => (
            <div className="card" key={keyOf(c)} style={{ borderColor: statusColor(c.status) }}>
              <h3>
                {c.name || c.target} <span className="muted">· {c.type}</span>
              </h3>
              <a className="url" href={c.target} target="_blank" rel="noreferrer">
                {c.target}
              </a>
              <StatusBadge status={c.status} />
              <div className="msg">{c.message}</div>
              <div className="muted" style={{ marginTop: 10 }}>
                {formatTime(c.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Protected>
  );
}
