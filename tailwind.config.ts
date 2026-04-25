import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211F",
        moss: "#3B6F5A",
        clay: "#B8664B",
        cloud: "#F5F7F6",
        line: "#DDE5E1"
      },
      boxShadow: {
        soft: "0 12px 30px rgba(23, 33, 31, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
