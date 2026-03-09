"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const path = usePathname();
  return (
    <nav
      style={{
        background: "#111118",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 44,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "white" }}>
          🏆 TopBet
        </span>
      </Link>
      <div style={{ display: "flex", gap: 4 }}>
        {[
          { href: "/", label: "Dashboard" },
          { href: "/picks", label: "Picks 🎯" },
          { href: "/parlays", label: "🎰 Parlays" },
          { href: "/tracker", label: "Tracker" },
          { href: "/stats", label: "📊 Stats" },
          { href: "/about", label: "🧠 How It Works" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              textDecoration: "none",
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: path === href ? 600 : 400,
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
