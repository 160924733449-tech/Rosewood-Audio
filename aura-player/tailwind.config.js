/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        spotifyGreen: '#1DB954',
        spotifyBlack: '#121212',
        spotifyDarkGray: '#212121',
        spotifyLightGray: '#535353',
      }
    },
  },
  plugins: [],
}
