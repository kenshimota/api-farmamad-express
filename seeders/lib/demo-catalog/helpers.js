/**
 * Builds Sequelize options including an optional transaction.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {object} Query options.
 */
function options(transaction) {
  return transaction ? { transaction } : {};
}

/**
 * Finds a row or creates it. Rows are matched sequentially, which is enough for
 * a seeder that owns the demo keys.
 * @param {object} model - Sequelize model.
 * @param {object} where - Lookup condition.
 * @param {object} defaults - Values used on creation.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} The existing or created instance.
 */
async function findOrCreate(model, where, defaults, transaction) {
  const existing = await model.findOne({ where, ...options(transaction) });

  if (existing) {
    return existing;
  }

  return model.create({ ...defaults }, options(transaction));
}

/**
 * Finds a row by its stable demo keys and updates it, or creates it when it
 * does not exist yet. The lookup condition doubles as creation defaults, so the
 * idempotency keys stay stable even if the caller only passes mutable values.
 * @param {object} model - Sequelize model.
 * @param {object} where - Stable demo lookup keys.
 * @param {object} values - Mutable values to write.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} The updated or created instance.
 */
async function upsert(model, where, values, transaction) {
  const existing = await model.findOne({ where, ...options(transaction) });

  if (existing) {
    await existing.update(values, options(transaction));
    return existing;
  }

  return model.create({ ...where, ...values }, options(transaction));
}

module.exports = { findOrCreate, options, upsert };
