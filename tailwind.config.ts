import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1115",
        panel: "#171b22",
        line: "#2a303a",
        gold: "#c8aa6e",
        teal: "#0ac8b9",
        danger: "#e84057"
      }
    }
  },
  plugins: []
};

export default config;
