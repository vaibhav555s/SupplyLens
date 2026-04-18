/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#08080f',
        'bg-card': '#111118',
        'bg-card-hover': '#16161f',
        'purple-primary': '#7c3aed',
        'purple-light': '#a855f7',
      },
      fontFamily: {
        'sora': ['Sora', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
