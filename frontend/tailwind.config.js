/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,ts,tsx}",
    "./src/**/*.{js,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#7C3AED",
          accent: "#06D6A0",
          secondary: "#64748B",
        },
      },
    },
  },
  plugins: [],
};
