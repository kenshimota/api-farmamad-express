const { Op } = require("sequelize");
const sequelize = require("../database");
const Payment = require("../models/payment");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const Customer = require("../models/customer");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const Currency = require("../models/currency");
const Image = require("../models/image");
const PaymentStatus = require("../models/payment-status");
const PaymentStatusHistory = require("../models/payment-status-history");
const PaymentAllocation = require("../models/payment-allocation");
const User = require("../models/user");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { createWalletOperations } = require("./wallet-operations");
const { createAssetOperations } = require("./repository-assets");
const { findPage } = require("../shared/pagination");
const { buildTextSearch } = require("../shared/list-query");
const SORT_FIELDS = Object.freeze([
  "id",
  "paid_at",
  "amount",
  "status",
  "customer_id",
  "method_payment_id",
  "currency_id",
]);
const {
  LIST_ORDER,
  METHOD_ATTRIBUTES,
  TYPE_ATTRIBUTES,
  buildHistoryOrder,
  buildPaymentIncludes,
} = require("./includes");

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
  imageModel = Image,
  statusModel = PaymentStatus,
  historyModel = PaymentStatusHistory,
  userModel = User,
  connection = sequelize,
} = {}) {
  const models = {
    methodModel,
    currencyModel,
    statusModel,
    imageModel,
    historyModel,
    userModel,
  };
  const currencyInclude = {
    model: currencyModel,
    as: "currency",
    attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
  };

  const walletOperations = createWalletOperations({
    walletModel,
    transactionModel,
    currencyInclude,
  });
  const assetOperations = createAssetOperations({
    model,
    imageModel,
    historyModel,
    userModel,
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
     * Finds a payment by primary key with its method, currency, status and
     * reference image. History is nested only when requested.
     * @param {number} id - Payment id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @param {object} [readOptions] - Read options.
     * @param {boolean} [readOptions.includeHistory] - Nest the history.
     * @returns {Promise<object|null>} The payment or null.
     */
    findById(id, options = {}, { includeHistory = false } = {}) {
      const query = {
        ...options,
        include: buildPaymentIncludes(models, includeHistory),
      };

      if (includeHistory) {
        query.order = buildHistoryOrder(historyModel);
      }

      return model.findByPk(id, query);
    },

    /**
     * Loads one payment and locks its row for the reconciliation transaction.
     * @param {number} id - Payment id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked payment or null.
     */
    findPaymentForUpdate(id, transaction) {
      return model.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    },

    /**
     * Lists payments ordered by `paid_at` and `id` descending.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching payments.
     */
    list(
      {
        customerId,
        methodPaymentId,
        currencyId,
        status,
        paidFrom,
        paidTo,
        invoiceId,
        q,
      } = {},
      { pagination, order = LIST_ORDER } = {},
    ) {
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

      if (status !== undefined) {
        where.status = status;
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

      const include = buildPaymentIncludes(models);
      const search = buildTextSearch(q, ["reference", "notes"]);

      if (search) {
        Object.assign(where, search);
      }

      if (invoiceId !== undefined) {
        include.push({
          model: PaymentAllocation,
          as: "allocations",
          attributes: [],
          required: true,
          where: { invoice_id: invoiceId },
        });
      }

      return findPage(model, { where, order, include }, pagination);
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
        include: buildPaymentIncludes(models),
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
    ...assetOperations,
  };
}

const paymentRepository = createPaymentRepository();

module.exports = {
  LIST_ORDER,
  METHOD_ATTRIBUTES,
  SORT_FIELDS,
  createPaymentRepository,
  paymentRepository,
};
