/**
 * StrykerJS configuration for the HU-09 welcome-email modules.
 *
 * Only the production modules introduced/changed by HU-09 are mutated; tests,
 * migrations, seeders and node_modules stay out of the analysis. The Jest
 * configuration lives in package.json, which the jest-runner reads on its own.
 */
module.exports = {
  packageManager: "npm",
  testRunner: "jest",
  jest: {
    projectType: "custom",
  },
  mutate: [
    "src/config/product.js",
    "src/auth/mailer.js",
    "src/auth/email-templates.js",
    "src/auth/welcome.js",
    "src/users/index.js",
    "src/auth/bootstrap.js",
  ],
  reporters: ["clear-text", "progress", "json"],
  jsonReporter: {
    fileName: "reports/mutation/mutation.json",
  },
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  tempDirName: ".stryker-tmp",
  concurrency: 2,
};
