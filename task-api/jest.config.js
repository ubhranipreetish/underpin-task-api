module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js'],
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
};
