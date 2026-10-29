const { toPublicSupplier } = require("../suppliers/serializer");
const { toPublicCurrencySummary } = require("../currencies/serializer");
const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Converts a DECIMAL value (usually a string) into a JSON number with two
 * decimals. Invalid values become null.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric value or null.
 */
function toMoneyNumber(value) {
  return toDecimalNumber(value, 2);
}

/**
 * Builds the public representation of a purchase line. Audit columns and the
 * nested product/item state are left out on purpose.
 * @param {object} item - Purchase item instance or plain object.
 * @returns {{ id: number, product_id: number, item_state_id: number,
 *   quantity: number, unit_cost: number|null, subtotal: number|null }}
 *   Public line data.
 */
function toPublicPurchaseItem(item) {
  return {
    id: readField(item, "id"),
    product_id: readField(item, "product_id"),
    item_state_id: readField(item, "item_state_id"),
    quantity: readField(item, "quantity"),
    unit_cost: toMoneyNumber(readField(item, "unit_cost")),
    subtotal: toMoneyNumber(readField(item, "subtotal")),
  };
}

/**
 * Serializes `confirmed_at` as an ISO string only when it is present, so draft
 * purchases keep the exact contract shape without the field.
 * @param {unknown} value - Date, string or null.
 * @returns {string|undefined} The ISO timestamp or undefined.
 */
function toConfirmedAt(value) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Builds the public representation of a purchase. Totals are numbers even
 * though Sequelize returns DECIMAL columns as strings. `items` and `supplier`
 * are nested only when requested and loaded.
 * @param {object} purchase - Purchase instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeItems] - Nest the purchase lines.
 * @param {boolean} [options.includeSupplier] - Nest the supplier.
 * @returns {object} Public purchase data.
 */
function toPublicPurchase(
  purchase,
  { includeItems = false, includeSupplier = false } = {},
) {
  const currency = readField(purchase, "currency");
  const data = {
    id: readField(purchase, "id"),
    number: readField(purchase, "number"),
    supplier_id: readField(purchase, "supplier_id"),
    currency_id: readField(purchase, "currency_id") ?? null,
    status: readField(purchase, "status"),
    subtotal: toMoneyNumber(readField(purchase, "subtotal")),
    tax_rate: toMoneyNumber(readField(purchase, "tax_rate")),
    tax_amount: toMoneyNumber(readField(purchase, "tax_amount")),
    total: toMoneyNumber(readField(purchase, "total")),
    notes: readField(purchase, "notes"),
  };
  const confirmedAt = toConfirmedAt(readField(purchase, "confirmed_at"));
  const items = readField(purchase, "items");
  const supplier = readField(purchase, "supplier");

  if (currency) {
    data.currency = toPublicCurrencySummary(currency);
  }

  if (confirmedAt !== undefined) {
    data.confirmed_at = confirmedAt;
  }

  if (includeItems && Array.isArray(items)) {
    data.items = items.map((item) => toPublicPurchaseItem(item));
  }

  if (includeSupplier && supplier) {
    data.supplier = toPublicSupplier(supplier);
  }

  return data;
}

module.exports = {
  toMoneyNumber,
  toPublicPurchase,
  toPublicPurchaseItem,
};
