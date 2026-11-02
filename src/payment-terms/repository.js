const PaymentTerm = require("../models/payment-term");
const Customer = require("../models/customer");
const Order = require("../models/order");
const Invoice = require("../models/invoice");

const LIST_ORDER = Object.freeze([
  ["days", "ASC"],
  ["id", "ASC"],
]);

/**
 * Creates the repository that encapsulates every persistence call of the
 * payment-terms module. Models are injectable so the abstraction stays
 * testable without a real database.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - PaymentTerm model.
 * @param {object} [options.customerModel] - Customer model.
 * @param {object} [options.orderModel] - Order model.
 * @param {object} [options.invoiceModel] - Invoice model.
 * @returns {object} Payment term repository.
 */
function createPaymentTermRepository({
  model = PaymentTerm,
  customerModel = Customer,
  orderModel = Order,
  invoiceModel = Invoice,
} = {}) {
  return {
    /**
     * Persists a payment term.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists terms ordered by days and id ascending.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.isActive] - Filter by active status.
     * @returns {Promise<object[]>} The matching terms.
     */
    list({ isActive } = {}) {
      const options = { order: LIST_ORDER };

      if (isActive !== undefined) {
        options.where = { is_active: isActive };
      }

      return model.findAll(options);
    },

    /**
     * Finds a term by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} term - Loaded instance.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The updated instance.
     */
    update(term, values) {
      return term.update(values);
    },

    /**
     * Permanently removes an instance.
     * @param {object} term - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(term) {
      return term.destroy();
    },

    /**
     * Tells whether a term is assigned to a customer, order or invoice.
     * @param {number} id - Payment term id.
     * @returns {Promise<boolean>} True when it is referenced.
     */
    async isInUse(id) {
      const [customers, orders, invoices] = await Promise.all([
        customerModel.count({ where: { payment_term_id: id } }),
        orderModel.count({ where: { payment_term_id: id } }),
        invoiceModel.count({ where: { payment_term_id: id } }),
      ]);

      return customers > 0 || orders > 0 || invoices > 0;
    },
  };
}

const paymentTermRepository = createPaymentTermRepository();

module.exports = {
  LIST_ORDER,
  createPaymentTermRepository,
  paymentTermRepository,
};
