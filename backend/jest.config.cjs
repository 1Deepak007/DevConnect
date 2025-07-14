// backend/jest.config.cjs
module.exports = {
  // We no longer need this as Babel will handle ESM transpilation
  // extensionsToTreatAsEsm: ['.js'],

  // Remove the custom resolver now that Babel handles ESM
  // resolver: '<rootDir>/jest-resolver.cjs', // <-- REMOVE OR COMMENT OUT THIS LINE

  // Configure Jest to use babel-jest for .js files
  transform: {
    '^.+\\.js$': 'babel-jest', // Use babel-jest for all .js files
  },

  // The root directory for your tests.
  rootDir: './',

  // The pattern Jest uses to find test files.
  testMatch: [
    '**/automation_testing/**/*.test.js',
    '**/automation_testing/**/*.api.test.js'
  ],

  // This sets up global test environment variables
  setupFiles: ['<rootDir>/automation_testing/setup.js'],

  // Optional: Collect code coverage
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/automation_testing/'
  ],
  // Add other Jest configurations as needed
};