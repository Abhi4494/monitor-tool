"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearAuth } from "../lib/auth";
import { fetchJSON } from "../lib/api";
import Nav from "./Nav";

// Wraps protected pages: validates the token, redirects to /login if missing
// or invalid, and only then renders the app shell + page content.
export default function Protected({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchJSON("/api/auth/me")
      .then(() => setReady(true))
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
  }, [router]);

  if (!ready) {
    return (
      <main className="container">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <>
      <Nav />
      <main className="container">{children}</main>
    </>
  );
}
