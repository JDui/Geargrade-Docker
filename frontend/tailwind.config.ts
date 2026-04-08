import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b1018",
        panel: "#111926",
        panelAlt: "#182233",
        line: "#223045",
        accent: "#5cc8ff",
        success: "#52c98d",
        warning: "#f3c969",
        danger: "#ef6f7d"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(5, 10, 20, 0.35)"
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(92, 200, 255, 0.12) 1px, transparent 0)"
      }
    }
  },
  plugins: []
} satisfies Config;
