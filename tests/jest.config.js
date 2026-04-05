/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setup.js'],
};
