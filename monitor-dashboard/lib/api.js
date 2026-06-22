import { getToken, clearAuth } from "./auth";

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

// Core request helper: attaches the JWT, parses errors, and bounces to /login on 401.
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${SERVER_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
      location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const fetchJSON = (path) => request(path);
export const apiPost = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });
export const apiPut = (path, body) =>
  request(path, { method: "PUT", body: JSON.stringify(body) });
export const apiDelete = (path) => request(path, { method: "DELETE" });

export function statusColor(status) {
  switch (status) {
    case "UP":
    case "OK":
      return "#16a34a";
    case "DOWN":
    case "FAILED":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

export function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
