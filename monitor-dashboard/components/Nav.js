"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, clearAuth } from "../lib/auth";

const links = [
  { href: "/", label: "Live Status" },
  { href: "/logs", label: "Error Logs" },
  { href: "/alerts", label: "Alerts" },
  { href: "/targets", label: "Targets" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => setUser(getUser()), []);

  function logout() {
    clearAuth();
    router.replace("/login");
  }

  return (
    <nav className="nav">
      <span className="brand">🖥️ Website Monitor</span>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
      {user && <span className="muted">{user.email}</span>}
      <button className="logout" onClick={logout}>
        Logout
      </button>
    </nav>
  );
}
