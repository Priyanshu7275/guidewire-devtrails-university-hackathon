/*
 * postcss.config.js
 *
 * PostCSS is the CSS processor that Vite uses under the hood.
 * We only need two plugins:
 *   1. tailwindcss  — generates utility classes from our config.
 *   2. autoprefixer — adds vendor prefixes (-webkit-, -moz- etc.) so our
 *                     CSS works in older browsers automatically.
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
