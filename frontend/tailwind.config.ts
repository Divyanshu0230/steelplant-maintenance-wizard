import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
          950: "#09090B",
        },
        copper: {
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#9A8F85",
          600: "#71717A",
          700: "#52525B",
          800: "#3F3F46",
        },
        steel: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          900: "#18181B",
        },
        tata: {
          ink: "#09090B",
          charcoal: "#18181B",
          silver: "#D4D4D8",
          platinum: "#F5F5F7",
          ivory: "#FAFAFA",
        },
        risk: {
          low: "#4ADE80",
          medium: "#FACC15",
          high: "#FB923C",
          critical: "#EF4444",
        },
        status: {
          healthy: "#4ADE80",
          warning: "#FACC15",
          critical: "#EF4444",
          info: "#A1A1AA",
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "slide-in-right": "slide-in-right 0.4s ease-out both",
        "scale-in": "scale-in 0.4s ease-out both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
