import forms from "@tailwindcss/forms";

export default {
  darkMode: "class",
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./content/**/*.json",
  ],
  theme: {
    extend: {
      colors: {
        "coal-black": "#1B1B1B",
        "soft-bone": "#EAE3D2",
        "faded-rust": "#A7552B",
        "sepia-smoke": "#746A5C",
        "midnight-teal": "#2E4B4F",
        "aged-brass": "#C9A66B",
        "desaturated-blood": "#8A3B3B",
      },
      fontFamily: {
        hero: ["'Josefin Sans'", "sans-serif"],
        sans: ["'Nunito Sans'", "sans-serif"],
      },
    },
  },
  plugins: [forms],
};
