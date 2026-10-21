/** @type {import('tailwindcss').Config} */
// Sistema de diseño: Design.md ("Clinical Blueprint on Frosted Paper").
// Los colores son tokens semánticos definidos como variables CSS en styles.css (:root y .dark),
// así cada clase funciona en modo claro y oscuro sin necesidad de variantes dark:.
// Para regenerar tailwind.min.css: npx tailwindcss@3.4.17 -i src-tailwind.css -o tailwind.min.css --minify
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./app.js",
    "./styles.css"
  ],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        paper: token('paper'),
        alt: token('alt'),
        muted: token('muted'),
        ink: token('ink'),
        soft: token('soft'),
        mid: token('mid'),
        faint: token('faint'),
        line: token('line'),
        ember: token('ember'),
        primary: token('primary'),
        'on-primary': token('on-primary'),
      },
      fontFamily: {
        sans: ['"Geist"', '"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"Geist"', '"Inter"', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: {
        md: '10px',
        lg: '18px',
        xl: '24px',
        '2xl': '24px',
        '3xl': '24px',
      }
    }
  },
  plugins: [],
};
