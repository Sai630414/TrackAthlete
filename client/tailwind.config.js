/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 215 27.9% 16.9%))",
        input: "hsl(var(--input, 215 27.9% 16.9%))",
        ring: "hsl(var(--ring, 216 12.2% 83.9%))",
        background: "hsl(var(--background, 224 71.4% 4.1%))",
        foreground: "hsl(var(--foreground, 210 20% 98%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 210 20% 98%))",
          foreground: "hsl(var(--primary-foreground, 220.9 39.3% 11%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 215 27.9% 16.9%))",
          foreground: "hsl(var(--secondary-foreground, 210 20% 98%))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive, 0 62.8% 30.6%))",
          foreground: "hsl(var(--destructive-foreground, 210 20% 98%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 215 27.9% 16.9%))",
          foreground: "hsl(var(--muted-foreground, 217.9 10.6% 64.9%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 215 27.9% 16.9%))",
          foreground: "hsl(var(--accent-foreground, 210 20% 98%))",
        },
        card: {
          DEFAULT: "hsl(var(--card, 224 71.4% 4.1%))",
          foreground: "hsl(var(--card-foreground, 210 20% 98%))",
        },
        ink: '#ffffff',
        panel: '#fcfcf8',
        volt: '#e07050',
        coral: '#e07050',
        cyan: '#2f6d5a',
        forest: '#173235',
        sage: '#194e42',
      },
    },
  },
  plugins: [],
};
