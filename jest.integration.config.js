module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  maxWorkers: 1,
  testMatch: ["<rootDir>/src/**/*.integration.test.js"],
  setupFiles: ["<rootDir>/test/setup.integration.js"],
  globalSetup: "<rootDir>/test/global-setup.integration.js",
  globalTeardown: "<rootDir>/test/global-teardown.integration.js",
  testTimeout: 30000,
};
