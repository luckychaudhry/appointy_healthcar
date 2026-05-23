/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  extend: {
    keyframes: {
      shake: {
        '0%, 100%': { transform: 'translateX(0)' },
        '20%':       { transform: 'translateX(-6px)' },
        '40%':       { transform: 'translateX(6px)' },
        '60%':       { transform: 'translateX(-4px)' },
        '80%':       { transform: 'translateX(4px)' },
      }
    },
    animation: {
      shake: 'shake 0.5s ease-in-out',
    }
  }
  },
  theme: {
    extend: {
      gridTemplateColumns:{
        'auto':'repeat(auto-fill, minmax(200px, 1fr))'
      },
      colors:{
        'primary':'#5F6FFF'
      }
    },
  },
  plugins: [],
}