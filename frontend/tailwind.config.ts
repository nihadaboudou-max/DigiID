import type { Config } from "tailwindcss";

/**
 * Configuration Tailwind CSS — Palette Terre & Lagune DigiID.
 * Synchronisée avec la charte graphique (Lagune, Ocre Dakar, Terre cuite, Sable, Ardoise).
 */
const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette DigiID — référence : Charte Graphique
        lagune: {
          DEFAULT: "#1B4965",
          clair: "#2A6A8E",
          fonce: "#0F2F44",
        },
        ocre: {
          DEFAULT: "#E8A857",
          clair: "#F5C88B",
          fonce: "#C68936",
        },
        terre: {
          DEFAULT: "#C44536",
          clair: "#D86C5E",
        },
        sable: {
          DEFAULT: "#F5EFE6",
          clair: "#FBF7F0",
        },
        ardoise: {
          DEFAULT: "#2A2D34",
          clair: "#6B6F76",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        poppins: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        contenu: "1200px",
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'doux': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'chaud': '0 4px 12px rgba(27, 73, 101, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
