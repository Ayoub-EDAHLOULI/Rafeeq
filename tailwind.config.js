/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        card: "var(--card)",
        panel2: "var(--panel2)",
        text: "var(--text)",
        subText: "var(--subText)",
        faint: "var(--faint)",
        primary: "var(--primary)",
        accentFg: "var(--accentFg)",
        onAccent: "var(--onAccent)",
        dot: "var(--dot)",
        danger: "var(--danger)",
        warn: "var(--warn)",
        border: "var(--border)",
        inputBg: "var(--inputBg)",
      },
    },
  },
  plugins: [],
};
