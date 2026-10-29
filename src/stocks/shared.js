const { stockRepository } = require("./repository");
const {
  parseStockId,
  STOCK_ID_MESSAGE,
  STOCK_NOT_FOUND_MESSAGE,
} = require("./validators");

/**
 * Express middleware for the stock detail route. It parses the `:id`
 * parameter, answers 422 when it is not a positive integer and 404 when the
 * stock does not exist; otherwise it exposes the loaded instance as
 * `req.stock` so the handler only serializes it.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadStock(req, res, next) {
  const id = parseStockId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: STOCK_ID_MESSAGE } });
  }

  const stock = await stockRepository.findById(id);

  if (!stock) {
    return res.status(404).json({ message: STOCK_NOT_FOUND_MESSAGE });
  }

  req.stock = stock;

  return next();
}

module.exports = { loadStock };
