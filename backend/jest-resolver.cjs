// jest-resolver.cjs
// A simple resolver for Jest's ESM support.
// It delegates to Node.js's default resolver.
module.exports = require('resolve').sync;