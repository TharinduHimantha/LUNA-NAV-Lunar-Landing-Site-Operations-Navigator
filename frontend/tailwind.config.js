/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        missionDark: '#0B0F19',
        panelDark: '#111827',
        solarGold: '#F59E0B',
        earthCyan: '#38BDF8',
        nominalGreen: '#10B981',
        eclipseCrimson: '#EF4444',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
