/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#06090e",
        surface: "#0c131d",
        "surface-border": "#16253b",
        arc: {
          cyan: "#00f0ff",
          teal: "#00ffcc",
          blue: "#0070f3",
          dark: "#030712",
          card: "rgba(12, 19, 29, 0.85)",
        },
      },
      fontFamily: {
        pixel: ["'Press Start 2P'", "monospace"],
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "cyan-glow": "0 0 25px rgba(0, 240, 255, 0.35)",
        "teal-glow": "0 0 25px rgba(0, 255, 204, 0.35)",
        "neon-box": "0 0 15px rgba(0, 240, 255, 0.2), inset 0 0 15px rgba(0, 240, 255, 0.1)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "grid-pan": "gridPan 20s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        gridPan: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 40px" },
        },
      },
    },
  },
  plugins: [],
};
