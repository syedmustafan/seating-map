/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Status tokens chosen for >= 4.5:1 contrast against the slate map bg.
        seat: {
          available: "#16a34a", // green-600
          reserved: "#d97706", // amber-600
          sold: "#9ca3af", // gray-400
          held: "#7c3aed", // violet-600
          selected: "#2563eb", // blue-600
        },
      },
    },
  },
  plugins: [],
};
