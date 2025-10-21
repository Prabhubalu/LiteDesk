// export default {
//   plugins: {
//     tailwindcss: {},
//     autoprefixer: {},
//   },
// }

// client/postcss.config.js

// CHANGE to module.exports for maximum compatibility
module.exports = { 
  plugins: {
    // CRITICAL: We need to explicitly 'require' the installed packages
    'tailwindcss/postcss': {}, 
    'autoprefixer': {},
  },
}