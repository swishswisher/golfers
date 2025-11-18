import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f8f4",
          100: "#d7ecdf",
          200: "#b0d9c0",
          300: "#85c39f",
          400: "#56aa7c",
          500: "#349162",
          600: "#28734d",
          700: "#1f583c",
          800: "#173f2b",
          900: "#102a1d",
        },
        ink: {
          900: "#131b26",
        },
        sand: {
          50: "#f9f6ef",
          100: "#f3f1e5",
        },
      },
      fontFamily: {
        sans: ["system-ui", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 45px rgba(0, 0, 0, 0.16)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;

