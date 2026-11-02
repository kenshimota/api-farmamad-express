/**
 * Truncates the given Sequelize models in order, cascading and restarting the
 * identities. Callers pass the models in foreign-key order.
 * @param {object[]} models - Sequelize models to truncate.
 * @returns {Promise<void>} Resolves once every table is empty.
 */
async function truncateModels(models) {
  for (const model of models) {
    await model.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });
  }
}

module.exports = { truncateModels };
