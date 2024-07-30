/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'tablet': '640px',   // Example: custom breakpoint for tablets
        'laptop': '1024px',  // Example: custom breakpoint for laptops
      },
      // Additional customizations can be added here
    },
  },
  plugins: [],
}
