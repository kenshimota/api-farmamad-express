const sequelize = require("../../src/database");
const Invoice = require("../../src/models/invoice");
const InvoiceItem = require("../../src/models/invoice-item");
const Payment = require("../../src/models/payment");
const PaymentAllocation = require("../../src/models/payment-allocation");
const CustomerWallet = require("../../src/models/customer-wallet");
const WalletTransaction = require("../../src/models/wallet-transaction");
const MethodPayment = require("../../src/models/method-payment");
const MethodPaymentType = require("../../src/models/method-payment-type");
const Customer = require("../../src/models/customer");
const User = require("../../src/models/user");
const { createInvoice } = require("./invoices");
const { buildFixture, createCurrency, createPayment } = require("./payments");
const { ensureDefaultTransactionCurrency } = require("./currency-default");

/**
 * Builds a customer with its tokens, a wallet funded through the payments API
 * and an invoice in its own currency.
 * @param {object} [options] - Fixture options.
 * @param {number} [options.deposit] - Wallet deposit amount.
 * @param {number} [options.total] - Invoice total.
 * @param {string} [options.invoiceRate] - Invoice currency rate in VES.
 * @returns {Promise<object>} The fixture.
 */
async function buildInvoicePaymentFixture(options = {}) {
  const fixture = await buildFixture();
  const invoiceCurrency =
    options.invoiceCurrency ??
    (await createCurrency({ rate: options.invoiceRate ?? "450.000000" }));
  const invoice = await createInvoice({
    customer_id: fixture.customer.id,
    invoiced_by_user_id: fixture.admin.user.id,
    currency_id: invoiceCurrency.id,
    total: options.total ?? 25,
  });
  const deposit = await createPayment(fixture, {
    amount: options.deposit ?? 100,
  });

  return {
    ...fixture,
    deposit,
    invoice,
    invoiceCurrency,
    paymentId: deposit.body.id,
  };
}

/**
 * Removes every row touched by the invoice payment suites in foreign key order.
 * @returns {Promise<void>} Resolves once the tables are clean.
 */
async function resetDatabase() {
  await WalletTransaction.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await PaymentAllocation.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await Payment.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await CustomerWallet.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await InvoiceItem.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await Invoice.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await MethodPayment.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await MethodPaymentType.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await User.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await Customer.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await sequelize.query("ALTER SEQUENCE invoices_number_seq RESTART WITH 1");
  await ensureDefaultTransactionCurrency();
}

module.exports = {
  buildInvoicePaymentFixture,
  resetDatabase,
};
