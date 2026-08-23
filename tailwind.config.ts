import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E8802B",
          dark: "#C4661A",
          light: "#F4A461",
        },
        ink: {
          950: "#0B0D10",
          900: "#12151A",
          800: "#1A1E24",
          700: "#242830",
        },
      },
    },
  },
  plugins: [],
};

export default config;
