import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        crm: {
          ink: "#14213d",
          sand: "#f7f3ea",
          ember: "#d97706",
          moss: "#3f5f45",
          slate: "#475569"
        }
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
