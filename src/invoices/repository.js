const { QueryTypes } = require("sequelize");
const sequelize = require("../database");
const Invoice = require("../models/invoice");
const InvoiceItem = require("../models/invoice-item");
const User = require("../models/user");
const PaymentTerm = require("../models/payment-term");
const {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  INVOICED_BY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  PAYMENT_ALLOCATION_INCLUDE,
  PAYMENT_CURRENCY_INCLUDE,
  PAYMENT_TERM_INCLUDE,
} = require("./includes");
const { findPage } = require("../shared/pagination");
const { buildListOptions } = require("./list-options");

/**
 * Creates a repository that encapsulates every persistence call of the
 * invoices module. Models and the Sequelize instance are injectable so the
 * abstraction stays testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Invoice model.
 * @param {object} [options.itemModel] - InvoiceItem model.
 * @param {object} [options.userModel] - User model.
 * @param {object} [options.db] - Shared Sequelize instance.
 * @returns {object} Invoice repository.
 */
function createInvoiceRepository({
  model = Invoice,
  itemModel = InvoiceItem,
  userModel = User,
  db = sequelize,
} = {}) {
  /**
   * Builds the includes of an invoice detail.
   * @param {boolean} includeItems - Nest the lines.
   * @param {boolean} includeInvoicedBy - Nest the internal user.
   * @param {boolean} includePayments - Nest the payment allocations.
   * @returns {object[]} Sequelize includes.
   */
  function detailIncludes(includeItems, includeInvoicedBy, includePayments) {
    const include = [CUSTOMER_INCLUDE, CURRENCY_INCLUDE, PAYMENT_TERM_INCLUDE];

    if (includeItems) {
      include.push(ITEM_INCLUDE);
    }

    if (includeInvoicedBy) {
      include.push(INVOICED_BY_INCLUDE);
    }

    if (includePayments) {
      include.push(PAYMENT_ALLOCATION_INCLUDE);
    }

    return include;
  }

  /**
   * Loads an invoice by primary key.
   * @param {number} id - Invoice id.
   * @param {object} [options] - Query options.
   * @param {boolean} [options.includeItems] - Nest the lines.
   * @param {boolean} [options.includeInvoicedBy] - Nest the internal user.
   * @param {boolean} [options.includePayments] - Nest the allocations.
   * @param {object} [options.transaction] - Open transaction.
   * @param {string} [options.lock] - Row lock mode.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(
    id,
    {
      includeItems = false,
      includeInvoicedBy = false,
      includePayments = false,
      transaction,
      lock,
    } = {},
  ) {
    return model.findByPk(id, {
      include: detailIncludes(includeItems, includeInvoicedBy, includePayments),
      transaction,
      lock,
    });
  }

  return {
    /**
     * Starts a transaction with the shared Sequelize instance.
     * @param {Function} callback - Work to run inside the transaction.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return db.transaction(callback);
    },

    /**
     * Reserves the next ascending invoice number from PostgreSQL.
     * `sequelize.query` is used instead of the raw `pg` driver so the call
     * participates in the current transaction.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<number>} The reserved number.
     */
    async nextNumber(transaction) {
      const [row] = await db.query(
        "SELECT nextval('invoices_number_seq') AS \"number\"",
        { type: QueryTypes.SELECT, transaction },
      );

      return Number(row.number);
    },

    /**
     * Persists an invoice header.
     * @param {object} values - Invoice attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The created instance.
     */
    create(values, { transaction } = {}) {
      return model.create(values, { transaction });
    },

    /**
     * Persists the immutable invoice lines.
     * @param {object[]} rows - Invoice item attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object[]>} The created instances.
     */
    createItems(rows, { transaction } = {}) {
      return itemModel.bulkCreate(rows, { transaction });
    },

    /**
     * Lists invoices ordered by issue date and id descending.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching instances.
     */
    list(filters, { pagination, order = LIST_ORDER } = {}) {
      return findPage(model, buildListOptions(filters, order), pagination);
    },

    findById,

    /**
     * Loads the invoice of an order.
     * @param {number} orderId - Order id.
     * @param {object} [options] - Query options.
     * @param {boolean} [options.includeItems] - Nest the lines.
     * @param {boolean} [options.includeInvoicedBy] - Nest the internal user.
     * @param {object} [options.transaction] - Open transaction.
     * @param {string} [options.lock] - Row lock mode.
     * @returns {Promise<object|null>} The instance or null.
     */
    findByOrderId(
      orderId,
      {
        includeItems = false,
        includeInvoicedBy = false,
        transaction,
        lock,
      } = {},
    ) {
      return model.findOne({
        where: { order_id: orderId },
        include: detailIncludes(includeItems, includeInvoicedBy),
        transaction,
        lock,
      });
    },

    /**
     * Tells whether an order already has an invoice.
     * @param {number} orderId - Order id.
     * @param {object} [transaction] - Open transaction.
     * @returns {Promise<boolean>} True when an invoice exists.
     */
    async hasOrderInvoice(orderId, transaction) {
      const invoice = await model.findOne({
        where: { order_id: orderId },
        attributes: ["id"],
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined,
      });

      return Boolean(invoice);
    },

    /**
     * Loads the authenticated actor from `users`.
     * @param {number} id - User id.
     * @param {object} [transaction] - Open transaction.
     * @returns {Promise<object|null>} The user or null.
     */
    findUserById(id, transaction) {
      return userModel.findByPk(id, { transaction });
    },

    /**
     * Loads the payment term snapshot referenced by an invoice.
     * @param {number} id - Payment term id.
     * @param {object} [transaction] - Open transaction.
     * @returns {Promise<object|null>} The term or null.
     */
    findPaymentTermById(id, transaction) {
      return PaymentTerm.findByPk(id, { transaction });
    },
  };
}

const invoiceRepository = createInvoiceRepository();

module.exports = {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  INVOICED_BY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  PAYMENT_TERM_INCLUDE,
  PAYMENT_ALLOCATION_INCLUDE,
  buildListOptions,
  createInvoiceRepository,
  invoiceRepository,
};
