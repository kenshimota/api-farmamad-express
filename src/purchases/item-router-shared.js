const { parsePurchaseId, parsePurchaseItemId } = require("./parsers");

/**
 * Parses the purchase id of a line route and answers 422 when invalid.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {number|null} The id or null after answering.
 */
function purchaseIdOrRespond(req, res) {
  const raw = req.params.id ?? req.params.purchase_id;
  const id = parsePurchaseId(raw);

  if (id === null) {
    res.status(422).json({ errors: { id: "Invalid purchase id" } });
  }

  return id;
}

/**
 * Parses the item id of a line route and answers 422 when invalid.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {number|null} The id or null after answering.
 */
function itemIdOrRespond(req, res) {
  const id = parsePurchaseItemId(req.params.item_id);

  if (id === null) {
    res.status(422).json({ errors: { id: "Invalid item id" } });
  }

  return id;
}

module.exports = { itemIdOrRespond, purchaseIdOrRespond };
