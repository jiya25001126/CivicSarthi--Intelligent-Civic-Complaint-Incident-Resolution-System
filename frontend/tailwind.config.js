/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0b2545',
          blue: '#134074',
          slate: '#1e293b',
          muted: '#64748b',
          light: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          accent: '#0284c7',
          gold: '#b45309'
        }
      }
    },
  },
  plugins: [],
}
