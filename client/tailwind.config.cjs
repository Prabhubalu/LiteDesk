/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    // ENSURE THIS PATH IS CORRECT for your project structure
    "./index.html", 
    "./src/**/*.{vue,js,ts,jsx,tsx}", // <-- This line typically covers everything in 'src'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}