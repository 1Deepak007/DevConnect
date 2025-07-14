// backend/babel.config.cjs
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current', // Transpile for the current Node.js version you are running
        },
        // Jest handles module transformation, so we tell Babel not to.
        // This is crucial for Jest's mocking to work correctly.
        modules: false,
      },
    ],
  ],
};