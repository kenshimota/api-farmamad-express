const { walletRepository } = require("./repository");

/**
 * Creates the wallet service. Every business rule lives here so routers only
 * parse, authorize and serialize.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Wallet repository.
 * @returns {object} The wallet service.
 */
function createWalletService({ repository = walletRepository } = {}) {
  return {
    /**
     * Lists every wallet of a customer.
     * @param {number} customerId - Customer id.
     * @returns {Promise<object[]>} The wallets.
     */
    listWallets(customerId, options) {
      return options === undefined
        ? repository.findByCustomer(customerId)
        : repository.findByCustomer(customerId, options);
    },

    /**
     * Loads one wallet by id.
     * @param {number} id - Wallet id.
     * @returns {Promise<object|null>} The wallet or null.
     */
    getWallet(id) {
      return repository.findById(id);
    },

    /**
     * Lists the movements of a wallet newest first.
     * @param {number} walletId - Wallet id.
     * @param {object} [options] - Listing options.
     * @returns {Promise<object[]>} The movements.
     */
    listTransactions(walletId, options) {
      return repository.listTransactions(walletId, options);
    },
  };
}

const walletService = createWalletService();

module.exports = { createWalletService, walletService };
