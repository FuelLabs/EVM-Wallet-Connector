/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    fontFamily: {
      sans: ['Px Grotesk', 'Segoe UI', 'Roboto', 'sans-serif'],
      mono: ['Px Grotesk Mono', 'monospace']
    }
  },
  plugins: []
};
