const { orderService } = require("../orders/service");
const { round2 } = require("../invoice-payments/calculations");
const { readField } = require("../shared/serializer");
const {
  currencyConfigurationIncomplete,
  currencyNotFound,
  invalidCurrency,
  orderAlreadyInvoiced,
  orderCancelled,
  orderNotQuotable,
  orderWithoutItems,
} = require("./errors");
const { documentRepository } = require("./repository");

const QUOTABLE_STATUSES = Object.freeze(["draft", "request", "generate"]);

/**
 * Converts a timestamp into an ISO string.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The ISO timestamp or null.
 */
function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Reads a positive currency rate.
 * @param {unknown} value - Raw rate.
 * @returns {number|null} The rate or null when missing/invalid.
 */
function positiveRate(value) {
  const rate = Number(value);

  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Builds the public currency data used by the PDF.
 * @param {object} currency - Currency instance or plain object.
 * @param {number} rate - Parsed rate.
 * @returns {object} Currency summary.
 */
function toDocumentCurrency(currency, rate) {
  return {
    id: Number(readField(currency, "id")),
    code: readField(currency, "code"),
    name: readField(currency, "name"),
    symbol: readField(currency, "symbol"),
    rate,
  };
}

/**
 * Builds the line table of a quotation, converting each line when needed.
 * @param {object[]} items - Order lines.
 * @param {number} exchangeRate - Rate applied to the quotation.
 * @returns {object[]} The quotation lines.
 */
function toQuotationItems(items, exchangeRate) {
  return items.map((item) => {
    const product = readField(item, "product");
    const itemState = readField(item, "item_state");
    const quantity = Number(readField(item, "quantity"));
    const unitPriceSource = Number(readField(item, "unit_price"));
    const unitPriceTarget = round2(unitPriceSource * exchangeRate);

    return {
      product_name: product ? readField(product, "name") : null,
      product_reference: product ? readField(product, "reference") : null,
      item_state_name: itemState
        ? (readField(itemState, "label") ?? readField(itemState, "name"))
        : null,
      quantity,
      unit_price_source: round2(unitPriceSource),
      subtotal_source: round2(readField(item, "subtotal")),
      unit_price_target: unitPriceTarget,
      subtotal_target: round2(quantity * unitPriceTarget),
    };
  });
}

/**
 * Builds the quotation document data from an already authorized order.
 * @param {object} input - Document input.
 * @param {object} input.order - Loaded order.
 * @param {object} input.sourceCurrency - Order currency.
 * @param {object} input.targetCurrency - Currency of the quotation.
 * @param {number} input.exchangeRate - Rate from source to target.
 * @param {unknown} input.sourceRateChangedAt - Last source rate change.
 * @param {unknown} input.targetRateChangedAt - Last target rate change.
 * @param {unknown} input.issuedAt - Document emission timestamp.
 * @returns {object} The quotation data.
 */
function buildQuotationData({
  order,
  sourceCurrency,
  targetCurrency,
  exchangeRate,
  sourceRateChangedAt,
  targetRateChangedAt,
  issuedAt,
}) {
  const items = toQuotationItems(readField(order, "items") ?? [], exchangeRate);
  const subtotalTarget = round2(
    items.reduce((sum, item) => sum + item.subtotal_target, 0),
  );
  const totalSource = round2(readField(order, "total"));
  const totalTarget = round2(totalSource * exchangeRate);
  const paymentTerm = readField(order, "payment_term");
  const customer = readField(order, "customer");

  return {
    order: {
      id: Number(readField(order, "id")),
      number: Number(readField(order, "number")),
      status: readField(order, "status"),
      created_at: toIso(readField(order, "createdAt")),
    },
    issued_at: toIso(issuedAt),
    customer: customer
      ? {
          fullName: readField(customer, "fullName"),
          email: readField(customer, "email"),
          direction: readField(customer, "direction"),
        }
      : null,
    delivery_address: readField(order, "delivery_address"),
    notes: readField(order, "notes"),
    payment_term: paymentTerm
      ? {
          name: readField(paymentTerm, "name"),
          days: Number(readField(paymentTerm, "days")),
        }
      : null,
    source_currency: toDocumentCurrency(
      sourceCurrency,
      Number(readField(sourceCurrency, "rate")),
    ),
    target_currency: toDocumentCurrency(
      targetCurrency,
      Number(readField(targetCurrency, "rate")),
    ),
    is_conversion:
      Number(readField(sourceCurrency, "id")) !==
      Number(readField(targetCurrency, "id")),
    exchange_rate: exchangeRate,
    source_rate_changed_at: toIso(sourceRateChangedAt),
    target_rate_changed_at: toIso(targetRateChangedAt),
    items,
    subtotal_source: round2(readField(order, "subtotal")),
    total_source: totalSource,
    subtotal_target: subtotalTarget,
    total_target: totalTarget,
    rounding_adjustment: round2(totalTarget - subtotalTarget),
  };
}

/**
 * Creates the quotation service.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.orderService] - Orders service.
 * @param {object} [dependencies.currencyRepository] - Currency/history queries.
 * @param {Function} [dependencies.clock] - Clock for the emission timestamp.
 * @returns {object} The quotation service.
 */
function createQuotationService({
  orderService: orders = orderService,
  currencyRepository = documentRepository,
  clock = () => new Date(),
} = {}) {
  /**
   * Loads an order, validates the quotation rules and builds the document.
   * @param {number} orderId - Order id.
   * @param {object} actor - JWT payload.
   * @param {object} [options] - Quotation options.
   * @param {number} [options.currencyId] - Target currency id.
   * @returns {Promise<object>} The quotation data.
   */
  async function getQuotation(orderId, actor, { currencyId } = {}) {
    const { order } = await orders.getOrder(orderId, actor);
    const status = readField(order, "status");

    if (status === "invoiced") {
      throw orderAlreadyInvoiced();
    }

    if (status === "cancelled") {
      throw orderCancelled();
    }

    if (!QUOTABLE_STATUSES.includes(status)) {
      throw orderNotQuotable();
    }

    const items = readField(order, "items");

    if (!Array.isArray(items) || items.length === 0) {
      throw orderWithoutItems();
    }

    const base = await currencyRepository.findBaseCurrency();
    const sourceCurrency = readField(order, "currency");
    const sourceRate = sourceCurrency
      ? positiveRate(readField(sourceCurrency, "rate"))
      : null;

    if (!base || !sourceRate) {
      throw currencyConfigurationIncomplete();
    }

    let targetCurrency = sourceCurrency;
    let targetRate = sourceRate;

    if (currencyId !== undefined && currencyId !== null) {
      targetCurrency = await currencyRepository.findCurrencyById(currencyId);

      if (!targetCurrency) {
        throw currencyNotFound();
      }

      const sameCurrency =
        Number(readField(sourceCurrency, "id")) ===
        Number(readField(targetCurrency, "id"));

      if (!sameCurrency && readField(targetCurrency, "is_active") === false) {
        throw invalidCurrency();
      }

      targetRate = sameCurrency
        ? sourceRate
        : positiveRate(readField(targetCurrency, "rate"));

      if (!targetRate) {
        throw currencyConfigurationIncomplete();
      }
    }

    const isConversion =
      Number(readField(sourceCurrency, "id")) !==
      Number(readField(targetCurrency, "id"));
    const exchangeRate = isConversion
      ? Number((sourceRate / targetRate).toFixed(6))
      : 1;
    const sourceHistory = await currencyRepository.findLatestRateChange(
      Number(readField(sourceCurrency, "id")),
    );
    const targetHistory = isConversion
      ? await currencyRepository.findLatestRateChange(
          Number(readField(targetCurrency, "id")),
        )
      : sourceHistory;

    return buildQuotationData({
      order,
      sourceCurrency,
      targetCurrency,
      exchangeRate,
      sourceRateChangedAt: sourceHistory
        ? readField(sourceHistory, "changed_at")
        : null,
      targetRateChangedAt: targetHistory
        ? readField(targetHistory, "changed_at")
        : null,
      issuedAt: clock(),
    });
  }

  return { getQuotation };
}

const quotationService = createQuotationService();

module.exports = {
  QUOTABLE_STATUSES,
  buildQuotationData,
  createQuotationService,
  quotationService,
  toQuotationItems,
};
