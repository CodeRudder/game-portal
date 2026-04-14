/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'gp-dark': '#0a0a1a',
        'gp-card': '#141428',
        'gp-border': '#2a2a4a',
        'gp-accent': '#6c5ce7',
        'gp-accent2': '#00cec9',
        'gp-neon': '#00f3ff',
        'gp-pink': '#fd79a8',
        'gp-gold': '#ffd700',
        'gp-green': '#00b894',
        'gp-orange': '#e17055',
      },
      fontFamily: {
        game: ['"Press Start 2P"', 'monospace'],
        ui: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
