import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "bg-primary": "#080808",
        "bg-secondary": "#0f0f14",
        "bg-surface": "#141419",
        "text-primary": "#f0f0f0",
        "text-secondary": "#888899",
        "text-muted": "#44444f",
        "accent-green": "#22c55e",
        "accent-red": "#ef4444",
        "accent-yellow": "#f59e0b",
        "accent-cream": "#e8e0d0",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
