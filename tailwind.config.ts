import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces (darkest → lightest)
        ink: {
          950: "#06080b",
          900: "#0a0d12",
          850: "#0e1218",
          800: "#131821",
          700: "#1a212c",
          600: "#252e3b",
          500: "#354154",
        },
        line: { DEFAULT: "#1c2330", strong: "#2b3546" },
        fg: { DEFAULT: "#e6e9ef", muted: "#98a2b3", dim: "#667085" },
        // Single accent used for "system signal" (links, selection, detections)
        signal: { DEFAULT: "#4fd1c5", strong: "#2dd4bf" },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", "16px"],
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "fade-in": "fade-in 0.25s ease-out both",
        "slide-in": "slide-in 0.22s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
