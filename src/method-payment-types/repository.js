const MethodPaymentType = require("../models/method-payment-type");
const Currency = require("../models/currency");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const {
  createMethodPaymentUsage,
  loadMethodPaymentModel,
} = require("./method-payment-usage");

const LIST_ORDER = Object.freeze([["code", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call of the
 * method-payment-types module. The models and the method payment usage strategy
 * are injectable to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - MethodPaymentType model.
 * @param {object} [options.currencyModel] - Currency model.
 * @param {() => object|null} [options.methodPaymentLoader] - Loader of the
 *   future MethodPayment model.
 * @returns {object} Method payment type repository.
 */
function createMethodPaymentTypeRepository({
  model = MethodPaymentType,
  currencyModel = Currency,
  methodPaymentLoader = loadMethodPaymentModel,
} = {}) {
  const usage = createMethodPaymentUsage({ loader: methodPaymentLoader });
  const include = [
    {
      model: currencyModel,
      as: "currency",
      attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
    },
  ];

  /**
   * Finds a type by primary key including its nested currency.
   * @param {number} id - Type id.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(id) {
    return model.findByPk(id, { include });
  }

  return {
    /**
     * Persists a new type and reloads it with the nested currency.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The created instance.
     */
    async create(values) {
      const created = await model.create(values);

      return findById(created.id);
    },

    /**
     * Lists types ordered by code, optionally filtered by currency and active
     * status, always eager-loading the currency to avoid N+1 queries.
     * @param {object} [filters] - Listing filters.
     * @param {number} [filters.currencyId] - Exact currency id.
     * @param {boolean} [filters.isActive] - Exact active status.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ currencyId, isActive } = {}) {
      const options = { order: LIST_ORDER, include };
      const where = {};

      if (currencyId !== undefined) {
        where.currency_id = currencyId;
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      if (Object.keys(where).length > 0) {
        options.where = where;
      }

      return model.findAll(options);
    },

    findById,

    /**
     * Persists changes on an existing type and reloads it so the nested
     * currency reflects a possible reference change.
     * @param {object} type - Loaded instance.
     * @param {object} values - Attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    async update(type, values) {
      await type.update(values);

      return findById(type.id);
    },

    /**
     * Permanently removes an existing type. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} type - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(type) {
      return type.destroy();
    },

    /**
     * Finds an active currency to validate the type reference.
     * @param {number} id - Currency id.
     * @returns {Promise<object|null>} The active currency or null.
     */
    findActiveCurrency(id) {
      return currencyModel.findOne({ where: { id, is_active: true } });
    },

    /**
     * Counts the concrete methods of a type. When HU-29 has not been
     * implemented the model is absent and the count is zero.
     * @param {number} id - Type id.
     * @returns {Promise<number>} The amount of concrete methods.
     */
    countMethods(id) {
      return usage.countMethods(id);
    },
  };
}

const methodPaymentTypeRepository = createMethodPaymentTypeRepository();

module.exports = {
  LIST_ORDER,
  createMethodPaymentTypeRepository,
  methodPaymentTypeRepository,
};
