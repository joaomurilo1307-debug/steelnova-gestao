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
        fg: {
          DEFAULT: "#211C16",
          muted: "#6B6459",
        },
        ink: {
          950: "#F6F3EE",
          900: "#FFFFFF",
          800: "#F1ECE4",
          700: "#E4DDD1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
