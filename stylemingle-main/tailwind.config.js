/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-bg': '#F8F6F4',
        'secondary-bg': '#FFFFFF',
        'card-bg': '#FAF7F4',
        'pastel-coral': '#FF8B7B',
        'soft-blush': '#F4EDE6',
        'warm-taupe': '#D8A47F',
        'deep-espresso': '#3A2E2B',
        'night-charcoal': '#2B2B2B',
      },
      spacing: {
        's': '0.5rem',
        'm': '1rem',
        'l': '2rem',
        'xl': '3rem',
      },
      borderRadius: {
        'soft': '0.75rem',
        'btn': '0.5rem',
        'card': '1rem',
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'hover': '0 6px 10px -1px rgba(0, 0, 0, 0.15)',
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'serif': ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
};
