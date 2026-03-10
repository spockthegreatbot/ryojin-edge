"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const path = usePathname();
  return (
    <nav
      style={{
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "transparent",
      }}
    >
      {/* Left: TOPBET wordmark */}
      <Link href="/" style={{ textDecoration: "none" }}>
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 12,
            letterSpacing: "0.2em",
            color: "#444444",
            textTransform: "uppercase",
          }}
        >
          TOPBET
        </span>
      </Link>

      {/* Center: nav links */}
      <div style={{ display: "flex", gap: 28 }}>
        {[
          { href: "/", label: "Matches" },
          { href: "/picks", label: "Picks" },
          { href: "/parlays", label: "Parlays" },
          { href: "/stats", label: "Stats" },
          { href: "/tracker", label: "Tracker" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 400,
              color: path === href ? "#e8e0d0" : "#44444f",
              transition: "color 0.15s",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Right: CTA */}
      <Link
        href="/picks"
        style={{
          textDecoration: "none",
          fontSize: 11,
          fontFamily: "var(--font-dm-mono), monospace",
          letterSpacing: "0.05em",
          color: "#888899",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "5px 12px",
          borderRadius: 2,
        }}
      >
        View Picks
      </Link>
    </nav>
  );
}
