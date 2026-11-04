const { readField, toDecimalNumber } = require("../shared/serializer");
const { convertAmount, round2 } = require("./calculations");

/**
 * Converts a money value into a JSON number with two decimals.
 * @param {unknown} value - Raw money value.
 * @returns {number|null} The numeric value or null.
 */
function toMoney(value) {
  return toDecimalNumber(value, 2);
}

/**
 * Converts a currency rate into a JSON number with six decimals.
 * @param {unknown} value - Raw rate value.
 * @returns {number|null} The numeric value or null.
 */
function toRate(value) {
  return toDecimalNumber(value, 6);
}

/**
 * Serializes a timestamp as ISO 8601.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The ISO timestamp.
 */
function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Serializes a DATEONLY value as `YYYY-MM-DD`.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The date or null.
 */
function toDateOnly(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

/**
 * Builds the currency block of an equivalence response.
 * @param {object} currency - Currency instance or plain object.
 * @returns {{ id: number, code: string, name: string, symbol: string,
 *   rate: number|null, is_base: boolean }} Public currency data.
 */
function toPublicCurrency(currency) {
  return {
    id: readField(currency, "id"),
    code: readField(currency, "code"),
    name: readField(currency, "name"),
    symbol: readField(currency, "symbol"),
    rate: toRate(readField(currency, "rate")),
    is_base: Boolean(readField(currency, "is_base")),
  };
}

/**
 * Builds the payment term snapshot of an equivalence response.
 * @param {object|null} paymentTerm - Payment term or null.
 * @returns {{ id: number, code: string, name: string, days: number }|null}
 *   Public payment term or null.
 */
function toPublicPaymentTerm(paymentTerm) {
  if (!paymentTerm) {
    return null;
  }

  return {
    id: readField(paymentTerm, "id"),
    code: readField(paymentTerm, "code"),
    name: readField(paymentTerm, "name"),
    days: readField(paymentTerm, "days"),
  };
}

/**
 * Resolves the readable item state label, falling back to the name.
 * @param {object|null} itemState - Item state or null.
 * @returns {string|null} The label, the name or null.
 */
function itemStateName(itemState) {
  if (!itemState) {
    return null;
  }

  return readField(itemState, "label") || readField(itemState, "name");
}

/**
 * Builds one converted order line.
 * @param {object} item - Order item with product and item state.
 * @param {number} exchangeRate - Target units per source unit.
 * @returns {object} Public converted line.
 */
function toOrderLine(item, exchangeRate) {
  const product = readField(item, "product");
  const state = readField(item, "item_state");
  const quantity = Number(readField(item, "quantity"));
  const unitPriceTarget = convertAmount(
    readField(item, "unit_price"),
    exchangeRate,
  );

  return {
    order_item_id: readField(item, "id"),
    product_id: readField(item, "product_id"),
    product_name: product ? readField(product, "name") : null,
    product_reference: product ? readField(product, "reference") : null,
    item_state_id: readField(item, "item_state_id"),
    item_state_name: itemStateName(state),
    quantity,
    unit_price_source: toMoney(readField(item, "unit_price")),
    subtotal_source: toMoney(readField(item, "subtotal")),
    unit_price_target: unitPriceTarget,
    subtotal_target: round2(quantity * unitPriceTarget),
  };
}

/**
 * Builds one converted invoice line from its immutable snapshot.
 * @param {object} item - Invoice item snapshot.
 * @param {number} exchangeRate - Target units per source unit.
 * @returns {object} Public converted line.
 */
function toInvoiceLine(item, exchangeRate) {
  const quantity = Number(readField(item, "quantity"));
  const unitPriceTarget = convertAmount(
    readField(item, "unit_price"),
    exchangeRate,
  );

  return {
    order_item_id: readField(item, "order_item_id"),
    product_id: readField(item, "product_id"),
    product_name: readField(item, "product_name"),
    product_reference: readField(item, "product_reference"),
    item_state_id: readField(item, "item_state_id"),
    item_state_name: readField(item, "item_state_name"),
    quantity,
    unit_price_source: toMoney(readField(item, "unit_price")),
    subtotal_source: toMoney(readField(item, "subtotal")),
    unit_price_target: unitPriceTarget,
    subtotal_target: round2(quantity * unitPriceTarget),
  };
}

module.exports = {
  itemStateName,
  toDateOnly,
  toInvoiceLine,
  toIso,
  toMoney,
  toOrderLine,
  toPublicCurrency,
  toPublicPaymentTerm,
  toRate,
};
