const { readField } = require("../shared/serializer");
const { resolvePrice } = require("../pricing");
const { resolveDefaultTransactionCurrency } = require("../currencies/default");
const { priceListNotAssigned } = require("./errors");
const { translatePricingError } = require("./service-support");
const {
  calculateOrderTotals,
  toLineAmounts,
  toOrderAmounts,
} = require("./money");

/**
 * Creates the pricing helper used by drafts, requests and direct generation.
 * It is the only place where order lines are priced from the customer list.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {Function} [dependencies.priceResolver] - Shared pricing resolver.
 * @param {Function} [dependencies.resolveTransactionCurrency] - Default
 *   transaction currency resolver.
 * @returns {object} The pricing service.
 */
function createOrderPricingService({
  repository,
  priceResolver = resolvePrice,
  resolveTransactionCurrency = resolveDefaultTransactionCurrency,
}) {
  /**
   * Resolves the transaction currency of an order, falling back to the active
   * default when the relation is not loaded.
   * @param {object} order - Loaded order.
   * @returns {Promise<object>} The order currency.
   */
  async function resolveOrderCurrency(order) {
    const currency = readField(order, "currency");

    if (currency) {
      return currency;
    }

    return resolveTransactionCurrency();
  }

  /**
   * Resolves the customer price list of an order.
   * @param {object} order - Loaded order.
   * @returns {number} The price list id.
   * @throws {Error} 403 when the customer has no price list.
   */
  function resolvePriceListId(order) {
    const customer = readField(order, "customer");
    const priceListId = customer ? readField(customer, "price_list_id") : null;

    if (priceListId === null || priceListId === undefined) {
      throw priceListNotAssigned();
    }

    return Number(priceListId);
  }

  /**
   * Resolves the price of new draft lines before they are persisted.
   * @param {object[]} lines - Validated lines.
   * @param {number} priceListId - Customer price list id.
   * @param {object} currency - Transaction currency.
   * @returns {Promise<object[]>} Lines with `unit_price`.
   */
  async function priceLines(lines, priceListId, currency) {
    const priced = [];

    for (const line of lines) {
      try {
        const resolved = await priceResolver({
          product_id: line.product_id,
          item_state_id: line.item_state_id,
          price_list_id: priceListId,
          transactionCurrency: currency,
        });

        priced.push({ ...line, unit_price: resolved.price });
      } catch (error) {
        throw translatePricingError(error);
      }
    }

    return priced;
  }

  /**
   * Recalculates and persists every line and the order totals with the current
   * customer price list and item states.
   * @param {object} order - Loaded order with its lines.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object[]>} The updated lines.
   */
  async function recalculate(order, transaction) {
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return [];
    }

    const priceListId = resolvePriceListId(order);
    const currency = await resolveOrderCurrency(order);
    const priced = [];

    for (const item of order.items) {
      let resolved;

      try {
        resolved = await priceResolver({
          product_id: readField(item, "product_id"),
          item_state_id: readField(item, "item_state_id"),
          price_list_id: priceListId,
          transactionCurrency: currency,
        });
      } catch (error) {
        throw translatePricingError(error);
      }

      const amounts = toLineAmounts({
        quantity: readField(item, "quantity"),
        unit_price: resolved.price,
      });

      await repository.updateOrderItem(item, amounts, { transaction });
      priced.push({
        quantity: readField(item, "quantity"),
        unit_price: resolved.price,
      });
    }

    const totals = calculateOrderTotals(priced);

    await repository.updateOrder(order, toOrderAmounts(totals), {
      transaction,
    });

    return priced;
  }

  return {
    priceLines,
    assertActiveTransactionCurrency() {
      return resolveTransactionCurrency();
    },
    recalculate,
    resolveOrderCurrency,
    resolvePriceListId,
  };
}

module.exports = { createOrderPricingService };
