/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Android needs one font family per weight: use these instead of font-bold/font-medium.
      fontFamily: {
        sans: ["GoogleSans_400Regular"],
        "sans-medium": ["GoogleSans_500Medium"],
        "sans-semibold": ["GoogleSans_600SemiBold"],
        "sans-bold": ["GoogleSans_700Bold"],
      },
    },
  },
  plugins: [],
}
