const { Op } = require("sequelize");
const sequelize = require("../database");
const Payment = require("../models/payment");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const Customer = require("../models/customer");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const Currency = require("../models/currency");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { createWalletOperations } = require("./wallet-operations");

const LIST_ORDER = Object.freeze([
  ["paid_at", "DESC"],
  ["id", "DESC"],
]);
const METHOD_ATTRIBUTES = Object.freeze([
  "id",
  "label",
  "is_active",
  "method_payment_type_id",
]);
const TYPE_ATTRIBUTES = Object.freeze(["id", "is_active", "currency_id"]);
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
});

/**
 * Creates a repository that encapsulates every persistence call of the
 * payments module. All models and the connection are injectable for tests.
 * @param {object} [options] - Injectable dependencies.
 * @returns {object} Payment repository.
 */
function createPaymentRepository({
  model = Payment,
  walletModel = CustomerWallet,
  transactionModel = WalletTransaction,
  customerModel = Customer,
  methodModel = MethodPayment,
  typeModel = MethodPaymentType,
  currencyModel = Currency,
  connection = sequelize,
} = {}) {
  const paymentCurrency = {
    ...CURRENCY_INCLUDE,
    model: currencyModel,
  };
  const paymentIncludes = Object.freeze([
    {
      model: methodModel,
      as: "method_payment",
      attributes: [...METHOD_ATTRIBUTES],
    },
    paymentCurrency,
  ]);

  /**
   * Builds the payment include set.
   * @returns {object[]} Fresh include definitions.
   */
  function includes() {
    return paymentIncludes.map((include) => ({ ...include }));
  }

  const walletOperations = createWalletOperations({
    walletModel,
    transactionModel,
    currencyInclude: paymentCurrency,
  });

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
     * Finds a payment by primary key with its method and currency.
     * @param {number} id - Payment id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The payment or null.
     */
    findById(id, options = {}) {
      return model.findByPk(id, { ...options, include: includes() });
    },

    /**
     * Lists payments ordered by `paid_at` and `id` descending.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching payments.
     */
    list({ customerId, methodPaymentId, currencyId, paidFrom, paidTo } = {}) {
      const where = {};

      if (customerId !== undefined) {
        where.customer_id = customerId;
      }

      if (methodPaymentId !== undefined) {
        where.method_payment_id = methodPaymentId;
      }

      if (currencyId !== undefined) {
        where.currency_id = currencyId;
      }

      if (paidFrom !== undefined || paidTo !== undefined) {
        where.paid_at = {};

        if (paidFrom !== undefined) {
          where.paid_at[Op.gte] = paidFrom;
        }

        if (paidTo !== undefined) {
          where.paid_at[Op.lt] = paidTo;
        }
      }

      return model.findAll({
        where,
        order: LIST_ORDER,
        include: includes(),
      });
    },

    /**
     * Persists a payment and reloads it with its relations.
     * @param {object} values - Validated attributes.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The created payment.
     */
    async create(values, options) {
      const created = await model.create(values, options);

      return model.findByPk(created.id, {
        ...options,
        include: includes(),
      });
    },

    /**
     * Persists changes on an existing payment.
     * @param {object} payment - Loaded payment.
     * @param {object} values - Attributes to update.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The updated payment.
     */
    update(payment, values, options) {
      return payment.update(values, options);
    },

    /**
     * Removes an existing payment.
     * @param {object} payment - Loaded payment.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(payment, options) {
      return payment.destroy(options);
    },

    /**
     * Finds a customer by primary key.
     * @param {number} id - Customer id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The customer or null.
     */
    findCustomer(id, options = {}) {
      return customerModel.findByPk(id, options);
    },

    /**
     * Loads a payment method with its type and currency to validate it.
     * @param {number} id - Payment method id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The method or null.
     */
    findMethod(id, options = {}) {
      return methodModel.findByPk(id, {
        ...options,
        include: [
          {
            model: typeModel,
            as: "method_payment_type",
            attributes: [...TYPE_ATTRIBUTES],
            include: [
              {
                model: currencyModel,
                as: "currency",
                attributes: [...CURRENCY_SUMMARY_ATTRIBUTES, "is_active"],
              },
            ],
          },
        ],
      });
    },

    ...walletOperations,
  };
}

const paymentRepository = createPaymentRepository();

module.exports = {
  LIST_ORDER,
  createPaymentRepository,
  paymentRepository,
};
