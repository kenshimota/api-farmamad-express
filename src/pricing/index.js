const Cost = require("../models/cost");
const Currency = require("../models/currency");
const ItemState = require("../models/item-state");
const PriceList = require("../models/price-list");
const Product = require("../models/product");
const Tax = require("../models/tax");
const { resolveDefaultTransactionCurrency } = require("../currencies/default");
const { createHttpError } = require("../shared/http-error");
const { readField } = require("../shared/serializer");
const { MAX_MONEY, round2 } = require("../purchases/money");
const { isUsableCurrency } = require("./currency");
const { resolveProductTax } = require("./tax");

const CUSTOMER_PRICE_LIST_MESSAGE = "Customer price list is not assigned";
const INVALID_ITEM_STATE_MESSAGE = "Invalid item state";
const INVALID_PRICE_LIST_MESSAGE = "Invalid price list";
const INVALID_PERCENTAGE_MESSAGE = "Invalid percentage";
const NO_PRICE_MESSAGE =
  "Product has no price for this item state and price list";
const OUT_OF_RANGE_MESSAGE = "Price out of range";
const DEFAULT_TRANSACTION_MESSAGE =
  "Default transaction currency is not configured";

/**
 * Reads a numeric field from a Sequelize instance or a plain object.
 * @param {object} record - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function valueOf(record, field) {
  return readField(record, field);
}

/**
 * Builds the shared 422 error used when a product cannot be priced.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function noPriceError() {
  return createHttpError(422, {
    errors: { product_id: NO_PRICE_MESSAGE },
  });
}

/**
 * Validates the item state and returns it.
 * @param {number} itemStateId - Requested item state id.
 * @param {object} itemStateModel - Item state model.
 * @returns {Promise<object>} The sellable item state.
 * @throws {Error} 422 when the state is missing or not sellable.
 */
async function resolveSellableItemState(itemStateId, itemStateModel) {
  const itemState = await itemStateModel.findByPk(itemStateId);

  if (!itemState || !valueOf(itemState, "is_sellable")) {
    throw createHttpError(422, {
      errors: { item_state_id: INVALID_ITEM_STATE_MESSAGE },
    });
  }

  return itemState;
}

/**
 * Loads the price list used for the margin.
 * @param {number} priceListId - Customer price list id.
 * @param {object} priceListModel - Price list model.
 * @returns {Promise<object>} The price list.
 * @throws {Error} 422 when the price list does not exist.
 */
async function resolvePriceList(priceListId, priceListModel) {
  const priceList = await priceListModel.findByPk(priceListId);

  if (!priceList) {
    throw createHttpError(422, {
      errors: { price_list_id: INVALID_PRICE_LIST_MESSAGE },
    });
  }

  return priceList;
}

/**
 * Loads the cost row for `(product_id, item_state_id)` together with its
 * currency, falling back to an explicit lookup when the association is not
 * loaded.
 * @param {object} params - Lookup parameters.
 * @param {number} params.productId - Product id.
 * @param {number} params.itemStateId - Item state id.
 * @param {object} params.costModel - Cost model.
 * @param {object} params.currencyModel - Currency model.
 * @returns {Promise<{ cost: object, currency: object }|null>} The usable cost
 *   and its active currency, or null when the product is not sellable.
 */
async function resolveCost({
  productId,
  itemStateId,
  costModel,
  currencyModel,
}) {
  const cost = await costModel.findOne({
    where: { product_id: productId, item_state_id: itemStateId },
    include: [{ model: currencyModel, as: "currency" }],
  });

  if (!cost) {
    return null;
  }

  const amount = Number(valueOf(cost, "cost"));

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const nestedCurrency = valueOf(cost, "currency");
  const currency =
    nestedCurrency ??
    (await currencyModel.findByPk(valueOf(cost, "currency_id")));

  if (!isUsableCurrency(currency)) {
    return null;
  }

  return { cost, currency };
}

/**
 * Calculates the final price from a cost, a margin percentage and both
 * currencies. Pure function kept separate so the formula lives in one place.
 * @param {object} params - Calculation inputs.
 * @param {number|string} params.cost - Cost in the cost currency.
 * @param {number|string} params.percentage - Margin percentage in `[0, 100)`.
 * @param {number|string} params.costRate - Rate of the cost currency.
 * @param {number|string} params.transactionRate - Rate of the transaction
 *   currency.
 * @returns {number} The rounded price in the transaction currency.
 */
function calculateMarginPrice({ cost, percentage, costRate, transactionRate }) {
  const margin = 1 - Number(percentage) / 100;
  const priceWithMargin = Number(cost) / margin;
  const converted =
    (priceWithMargin * Number(costRate)) / Number(transactionRate);

  return round2(converted);
}

/**
 * Builds a price resolver bound to the given models. The resolver is shared by
 * the store catalog and the order creation flow, so the formula and every
 * error is defined exactly once.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.costModel] - Cost model.
 * @param {object} [options.currencyModel] - Currency model.
 * @param {object} [options.itemStateModel] - Item state model.
 * @param {object} [options.priceListModel] - Price list model.
 * @param {object} [options.productModel] - Product model.
 * @param {object} [options.taxModel] - Tax model.
 * @param {Function} [options.resolveTransactionCurrency] - Default transaction
 *   currency resolver.
 * @returns {Function} The `resolvePrice` function.
 */
function createPriceResolver({
  costModel = Cost,
  currencyModel = Currency,
  itemStateModel = ItemState,
  priceListModel = PriceList,
  productModel = Product,
  taxModel = Tax,
  resolveTransactionCurrency = resolveDefaultTransactionCurrency,
} = {}) {
  /**
   * Resolves the price a customer pays for a product in a given item state.
   * @param {object} params - Request parameters.
   * @param {number} params.product_id - Product id.
   * @param {number} params.item_state_id - Requested item state id.
   * @param {number|null} params.price_list_id - Customer price list id.
   * @param {object} [params.transactionCurrency] - Transaction currency; the
   *   active default is used when omitted.
   * @returns {Promise<{ product_id: number, item_state_id: number,
   *   price_list_id: number, price: number, currency: object,
   *   tax: object }>} The resolved price, the transaction currency and the
   *   product tax snapshot.
   * @throws {Error} 403 without a price list, 422 for invalid states, missing
   *   costs and out-of-range prices, and 503 without a default currency.
   */
  return async function resolvePrice({
    product_id: productId,
    item_state_id: itemStateId,
    price_list_id: priceListId,
    transactionCurrency,
  } = {}) {
    if (priceListId === null || priceListId === undefined) {
      throw createHttpError(403, { message: CUSTOMER_PRICE_LIST_MESSAGE });
    }

    const priceList = await resolvePriceList(priceListId, priceListModel);
    const percentage = Number(valueOf(priceList, "percentage"));
    const margin = 1 - percentage / 100;

    if (
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage >= 100 ||
      margin <= 0
    ) {
      throw createHttpError(422, {
        errors: { percentage: INVALID_PERCENTAGE_MESSAGE },
      });
    }

    await resolveSellableItemState(itemStateId, itemStateModel);

    const resolvedCost = await resolveCost({
      productId,
      itemStateId,
      costModel,
      currencyModel,
    });

    if (!resolvedCost) {
      throw noPriceError();
    }

    let currency = transactionCurrency;

    if (!currency) {
      currency = await resolveTransactionCurrency({ model: currencyModel });
    }

    if (!isUsableCurrency(currency)) {
      throw createHttpError(503, { message: DEFAULT_TRANSACTION_MESSAGE });
    }

    const price = calculateMarginPrice({
      cost: valueOf(resolvedCost.cost, "cost"),
      percentage,
      costRate: valueOf(resolvedCost.currency, "rate"),
      transactionRate: valueOf(currency, "rate"),
    });

    if (!Number.isFinite(price) || price < 0 || price > MAX_MONEY) {
      throw createHttpError(422, {
        errors: { product_id: OUT_OF_RANGE_MESSAGE },
      });
    }

    const tax = await resolveProductTax(productId, { productModel, taxModel });

    return {
      product_id: productId,
      item_state_id: itemStateId,
      price_list_id: priceListId,
      price,
      currency,
      tax,
    };
  };
}

const defaultResolver = createPriceResolver();

/**
 * Resolves a price with the application models.
 * @param {object} params - Request parameters.
 * @returns {Promise<object>} The resolved price and currency.
 */
function resolvePrice(params) {
  return defaultResolver(params);
}

module.exports = {
  CUSTOMER_PRICE_LIST_MESSAGE,
  DEFAULT_TRANSACTION_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  INVALID_PERCENTAGE_MESSAGE,
  INVALID_PRICE_LIST_MESSAGE,
  NO_PRICE_MESSAGE,
  OUT_OF_RANGE_MESSAGE,
  calculateMarginPrice,
  createPriceResolver,
  resolvePrice,
  resolveProductPrice: resolvePrice,
  round2,
};
