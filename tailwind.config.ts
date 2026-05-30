import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#050507",
        abyss: "#0a0a0e",
        ink: "#14141a",
        platinum: "#f3f1ea",
        ash: "#807d75",
        signal: "#ffb84d",
        pulse: "#5dd5e6",
        ember: "#ff5a47",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
