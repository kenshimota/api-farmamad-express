const { walletService } = require("./service");
const { invalidWalletId, walletNotFound } = require("./errors");
const { parseWalletId } = require("./parsers");
const { ownsCustomer } = require("../shared/customer-access");

/**
 * Express middleware for routes addressed by `:id`. It parses the parameter,
 * loads the wallet and answers 422/404 when needed. A customer can only reach
 * its own wallets; another customer's wallet is hidden behind a 404.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadWallet(req, res, next) {
  const id = parseWalletId(req.params.id);

  if (id === null) {
    return res.status(422).json(invalidWalletId().body);
  }

  const wallet = await walletService.getWallet(id);

  if (!wallet) {
    return res.status(404).json(walletNotFound().body);
  }

  const user = req.currentUser;

  if (user && (user.role?.name ?? user.role) === "customer") {
    if (!user.customer_id) {
      return res
        .status(403)
        .json({ message: "Customer profile is not linked" });
    }

    if (!ownsCustomer(user, wallet.customer_id)) {
      return res.status(404).json(walletNotFound().body);
    }
  }

  req.wallet = wallet;

  return next();
}

module.exports = { loadWallet };
