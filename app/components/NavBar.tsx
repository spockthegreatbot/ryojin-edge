"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const path = usePathname();
  return (
    <nav
      style={{
        background: "#12121a",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: "white" }}>
          🏆 TopBet
        </span>
      </Link>
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { href: "/", label: "Dashboard" },
          { href: "/picks", label: "Picks 🎯" },
          { href: "/tracker", label: "Tracker" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              background: path === href ? "#7c3aed" : "transparent",
              color: path === href ? "white" : "#9ca3af",
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
