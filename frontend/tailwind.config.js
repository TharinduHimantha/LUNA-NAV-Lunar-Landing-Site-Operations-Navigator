/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spaceBg: '#080C14',
        missionDark: '#0B0F19',
        panelDark: '#0F172A',
        cardDark: '#111827',
        solarGold: '#F59E0B',
        earthCyan: '#38BDF8',
        nominalGreen: '#10B981',
        eclipseCrimson: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};