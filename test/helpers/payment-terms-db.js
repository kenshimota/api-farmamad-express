const PaymentTerm = require("../../src/models/payment-term");
const Customer = require("../../src/models/customer");
const Order = require("../../src/models/order");
const User = require("../../src/models/user");
const InvoiceItem = require("../../src/models/invoice-item");
const Invoice = require("../../src/models/invoice");
const OrderItem = require("../../src/models/order-item");
const OrderHistory = require("../../src/models/order-history");
const OrderItemLotAllocation = require("../../src/models/order-item-lot-allocation");
const { ensureStandardPaymentTerms } = require("./payment-terms");

/**
 * Cleans every table related to payment terms and reseeds the standard terms.
 * @returns {Promise<void>} Resolves once the database is clean.
 */
async function resetPaymentTermDatabase() {
  for (const model of [
    InvoiceItem,
    Invoice,
    OrderItemLotAllocation,
    OrderHistory,
    OrderItem,
    Order,
    Customer,
    User,
  ]) {
    await model.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });
  }

  await PaymentTerm.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await ensureStandardPaymentTerms();
}

module.exports = { resetPaymentTermDatabase };
