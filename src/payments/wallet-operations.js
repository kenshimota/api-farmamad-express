const { Op } = require("sequelize");

/**
 * Builds the wallet persistence operations used by the payments repository.
 * Keeping them apart keeps every file small and lets the unit tests exercise
 * the locking behavior with simple model doubles.
 * @param {object} options - Injectable dependencies.
 * @param {object} options.walletModel - CustomerWallet model.
 * @param {object} options.transactionModel - WalletTransaction model.
 * @param {object} options.currencyInclude - Currency include for reloads.
 * @returns {object} The wallet operations.
 */
function createWalletOperations({
  walletModel,
  transactionModel,
  currencyInclude,
}) {
  return {
    /**
     * Finds or creates the wallet of a customer and currency and locks it for
     * update, so concurrent deposits serialize on the same row.
     * @param {number} customerId - Customer id.
     * @param {number} currencyId - Currency id.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The locked wallet.
     */
    async findOrCreateWallet(customerId, currencyId, options) {
      await walletModel.bulkCreate(
        [{ customer_id: customerId, currency_id: currencyId, balance: 0 }],
        { ignoreDuplicates: true, transaction: options.transaction },
      );

      // FOR UPDATE cannot lock the nullable side of an outer join, so the
      // currency is loaded by the unlocked reload after the increment.
      return walletModel.findOne({
        where: { customer_id: customerId, currency_id: currencyId },
        transaction: options.transaction,
        lock: options.transaction.LOCK.UPDATE,
      });
    },

    /**
     * Finds a wallet by id and locks it for update.
     * @param {number} id - Wallet id.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The locked wallet or null.
     */
    findWalletForUpdate(id, options) {
      return walletModel.findByPk(id, {
        transaction: options.transaction,
        lock: options.transaction.LOCK.UPDATE,
      });
    },

    /**
     * Adds an amount to the wallet balance using an atomic SQL increment.
     * @param {object} wallet - Locked wallet.
     * @param {number|string} amount - Signed amount.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The reloaded wallet.
     */
    async incrementBalance(wallet, amount, options) {
      await wallet.increment("balance", {
        by: amount,
        transaction: options.transaction,
      });

      return wallet.reload({
        transaction: options.transaction,
        include: [currencyInclude],
      });
    },

    /**
     * Appends a wallet movement.
     * @param {object} values - Movement attributes.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The created movement.
     */
    createWalletTransaction(values, options) {
      return transactionModel.create(values, options);
    },

    /**
     * Finds the deposit movement of a payment and locks it.
     * @param {number} paymentId - Payment id.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The movement or null.
     */
    findDeposit(paymentId, options) {
      return transactionModel.findOne({
        where: {
          payment_id: paymentId,
          transaction_type: "deposit",
        },
        transaction: options.transaction,
        lock: options.transaction.LOCK.UPDATE,
      });
    },

    /**
     * Removes one wallet movement.
     * @param {object} transaction - Movement instance.
     * @param {object} options - Sequelize options.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    removeWalletTransaction(transaction, options) {
      return transaction.destroy(options);
    },

    /**
     * Counts the invoice allocations of a payment. Until HU-43 creates the
     * invoice payment flow, any `invoice_payment` movement or any movement with
     * a `payment_allocation_id` counts as an allocation.
     * @param {number} paymentId - Payment id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<number>} The number of allocations.
     */
    countAllocations(paymentId, options = {}) {
      return transactionModel.count({
        where: {
          payment_id: paymentId,
          [Op.or]: [
            { transaction_type: "invoice_payment" },
            { payment_allocation_id: { [Op.ne]: null } },
          ],
        },
        ...options,
      });
    },
  };
}

module.exports = { createWalletOperations };
