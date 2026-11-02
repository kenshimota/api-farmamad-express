const Customer = require("../../src/models/customer");
const CustomerWallet = require("../../src/models/customer-wallet");
const MethodPayment = require("../../src/models/method-payment");
const MethodPaymentType = require("../../src/models/method-payment-type");
const Payment = require("../../src/models/payment");
const PaymentStatusHistory = require("../../src/models/payment-status-history");
const User = require("../../src/models/user");
const WalletTransaction = require("../../src/models/wallet-transaction");
const { truncateModels } = require("./database");

const PAYMENT_TABLES = Object.freeze([
  PaymentStatusHistory,
  WalletTransaction,
  Payment,
  CustomerWallet,
  MethodPayment,
  MethodPaymentType,
  User,
  Customer,
]);

/**
 * Truncates every table used by the wallet and payment suites.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
function resetDatabase() {
  return truncateModels(PAYMENT_TABLES);
}

module.exports = {
  PAYMENT_TABLES,
  resetDatabase,
};
