const { applyIntegrationEnvironment } = require("./helpers/test-database");

/**
 * Jest global teardown: closes the Sequelize connection used by the suite.
 * @returns {Promise<void>}
 */
module.exports = async () => {
  applyIntegrationEnvironment();

  const sequelize = require("../src/database");
  await sequelize.close();
};
