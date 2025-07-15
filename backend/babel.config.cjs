// backend/babel.config.cjs
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current', // Transpile for the current Node.js version
        },
        modules: 'commonjs', // Crucially, transform ES modules to CommonJS
      },
    ],
  ],
  plugins: [], // Add any other necessary Babel plugins here
};