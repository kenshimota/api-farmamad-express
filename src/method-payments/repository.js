const sequelize = require("../database");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const Currency = require("../models/currency");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

const LIST_ORDER = Object.freeze([
  ["method_payment_type_id", "ASC"],
  ["label", "ASC"],
]);
const TYPE_ATTRIBUTES = Object.freeze(["id", "code", "name", "currency_id"]);

/**
 * Creates a repository that encapsulates every persistence call of the
 * method-payments module. The models and the connection are injectable to keep
 * the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - MethodPayment model.
 * @param {object} [options.typeModel] - MethodPaymentType model.
 * @param {object} [options.currencyModel] - Currency model.
 * @param {object} [options.connection] - Sequelize connection.
 * @returns {object} Method payment repository.
 */
function createMethodPaymentRepository({
  model = MethodPayment,
  typeModel = MethodPaymentType,
  currencyModel = Currency,
  connection = sequelize,
} = {}) {
  const currencyInclude = Object.freeze({
    model: currencyModel,
    as: "currency",
    attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
  });
  const validationCurrencyInclude = Object.freeze({
    ...currencyInclude,
    attributes: [...CURRENCY_SUMMARY_ATTRIBUTES, "is_active"],
  });

  /**
   * Builds the payment type include, optionally filtering by currency.
   * @param {object} [where] - Extra filter for the included type.
   * @returns {object} The Sequelize include definition.
   */
  function typeInclude(where) {
    const include = {
      model: typeModel,
      as: "method_payment_type",
      attributes: [...TYPE_ATTRIBUTES],
      include: [currencyInclude],
    };

    if (where) {
      include.where = where;
      include.required = true;
    }

    return include;
  }

  /**
   * Finds a method payment by primary key including its type and currency.
   * @param {number} id - Method payment id.
   * @param {object} [options] - Sequelize options with the transaction.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(id, options = {}) {
    return model.findByPk(id, {
      ...options,
      include: [typeInclude()],
    });
  }

  return {
    /**
     * Runs a callback inside a database transaction.
     * @param {(transaction: object) => Promise<unknown>} callback - Work.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return connection.transaction(callback);
    },

    /**
     * Persists a new method payment and reloads it with its relations.
     * @param {object} values - Validated attributes.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object>} The created instance.
     */
    async create(values, options = {}) {
      const created = await model.create(values, options);

      return findById(created.id, options);
    },

    findById,

    /**
     * Lists methods ordered by type and label, applying the optional filters
     * and eager-loading the type and its currency to avoid N+1 queries.
     * @param {object} [filters] - Listing filters.
     * @param {number} [filters.methodPaymentTypeId] - Exact type id.
     * @param {number} [filters.currencyId] - Currency inherited from the type.
     * @param {boolean} [filters.isActive] - Exact active status.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ methodPaymentTypeId, currencyId, isActive } = {}) {
      const where = {};

      if (methodPaymentTypeId !== undefined) {
        where.method_payment_type_id = methodPaymentTypeId;
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      const typeWhere =
        currencyId === undefined ? undefined : { currency_id: currencyId };

      return model.findAll({
        where,
        order: LIST_ORDER,
        include: [typeInclude(typeWhere)],
      });
    },

    /**
     * Persists changes on an existing method payment.
     * @param {object} method - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(method, values, options = {}) {
      return method.update(values, options);
    },

    /**
     * Permanently removes an existing method payment.
     * @param {object} method - Loaded instance.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(method, options = {}) {
      return method.destroy(options);
    },

    /**
     * Loads a payment type with its currency to validate the reference and the
     * dynamic details definition.
     * @param {number} id - Type id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The type or null.
     */
    findType(id, options = {}) {
      return typeModel.findByPk(id, {
        ...options,
        include: [validationCurrencyInclude],
      });
    },
  };
}

const methodPaymentRepository = createMethodPaymentRepository();

module.exports = {
  LIST_ORDER,
  TYPE_ATTRIBUTES,
  createMethodPaymentRepository,
  methodPaymentRepository,
};
