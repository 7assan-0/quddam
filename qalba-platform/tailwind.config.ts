import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)", surface: "var(--color-primary-surface)",
        coral: "var(--color-secondary)", gold: "var(--color-accent-gold)",
        turquoise: "var(--color-accent-turquoise)", warm: "var(--color-bg)",
        success: "var(--color-success)", danger: "var(--color-danger)",
        neutral: { 100: "var(--neutral-100)", 200: "var(--neutral-200)", 300: "var(--neutral-300)", 400: "var(--neutral-400)", 500: "var(--neutral-500)", 600: "var(--neutral-600)", 700: "var(--neutral-700)", 800: "var(--neutral-800)", 900: "var(--neutral-900)" },
      },
      fontFamily: { arabic: ["var(--font-arabic)"], numeral: ["var(--font-numeral)"] },
      borderRadius: { "brand-sm": "var(--radius-sm)", "brand-md": "var(--radius-md)", "brand-lg": "var(--radius-lg)", "brand-xl": "var(--radius-xl)", pill: "var(--radius-pill)" },
      boxShadow: { card: "var(--shadow-sm)", modal: "var(--shadow-lg)", glow: "var(--shadow-glow)" },
      transitionDuration: { fast: "120ms", normal: "180ms", emphasis: "260ms" },
      maxWidth: { shell: "var(--layout-shell)", reading: "var(--layout-reading)", tv: "var(--layout-tv)" },
      zIndex: { header: "var(--z-header)", overlay: "var(--z-overlay)", modal: "var(--z-modal)", toast: "var(--z-toast)" },
      screens: { tv: "1600px" },
    },
  },
  plugins: [],
} satisfies Config;
