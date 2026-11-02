const sequelize = require("../database");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const Currency = require("../models/currency");
const User = require("../models/user");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { findPage } = require("../shared/pagination");

const WALLET_ORDER = Object.freeze([["currency_id", "ASC"]]);
const TRANSACTION_ORDER = Object.freeze([
  ["createdAt", "DESC"],
  ["id", "DESC"],
]);
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
});
const CREATED_BY_ATTRIBUTES = Object.freeze(["id", "username", "email"]);
const SORT_FIELDS = Object.freeze(["id", "currency_id", "customer_id"]);

/**
 * Creates a repository that encapsulates every persistence call of the wallet
 * module. The models and the connection are injectable for unit tests.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.walletModel] - CustomerWallet model.
 * @param {object} [options.transactionModel] - WalletTransaction model.
 * @param {object} [options.userModel] - User model.
 * @param {object} [options.connection] - Sequelize connection.
 * @returns {object} Wallet repository.
 */
function createWalletRepository({
  walletModel = CustomerWallet,
  transactionModel = WalletTransaction,
  userModel = User,
  connection = sequelize,
} = {}) {
  return {
    /**
     * Lists the wallets of a customer with their currency.
     * @param {number} customerId - Customer id.
     * @returns {Promise<object[]>} The wallets.
     */
    findByCustomer(customerId, { pagination, order = WALLET_ORDER } = {}) {
      return findPage(
        walletModel,
        {
          where: { customer_id: customerId },
          order,
          include: [CURRENCY_INCLUDE],
        },
        pagination,
      );
    },

    /**
     * Finds one wallet by primary key with its currency.
     * @param {number} id - Wallet id.
     * @returns {Promise<object|null>} The wallet or null.
     */
    findById(id) {
      return walletModel.findByPk(id, { include: [CURRENCY_INCLUDE] });
    },

    /**
     * Lists the movements of a wallet newest first, optionally including the
     * staff user that created each one.
     * @param {number} walletId - Wallet id.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.includeCreatedBy] - Include `created_by`.
     * @returns {Promise<object[]>} The movements.
     */
    listTransactions(walletId, { includeCreatedBy = false } = {}) {
      const include = [
        {
          model: walletModel,
          as: "wallet",
          attributes: ["id", "currency_id"],
          include: [CURRENCY_INCLUDE],
        },
      ];

      if (includeCreatedBy) {
        include.push({
          model: userModel,
          as: "created_by",
          attributes: [...CREATED_BY_ATTRIBUTES],
        });
      }

      return transactionModel.findAll({
        where: { wallet_id: walletId },
        order: TRANSACTION_ORDER,
        include,
      });
    },
  };
}

const walletRepository = createWalletRepository();

module.exports = {
  SORT_FIELDS,
  TRANSACTION_ORDER,
  WALLET_ORDER,
  createWalletRepository,
  walletRepository,
};
