const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Converts a DECIMAL value into a JSON number with two decimals.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric value or null.
 */
function toMoneyNumber(value) {
  return toDecimalNumber(value, 2);
}

/**
 * Serializes a timestamp as an ISO string, keeping strings untouched.
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
 * Builds the customer summary nested in an order.
 * @param {object} customer - Customer instance or plain object.
 * @returns {{ id: number, fullName: string, email: string,
 *   direction: string }} Public customer data.
 */
function toPublicCustomer(customer) {
  return {
    id: readField(customer, "id"),
    fullName: readField(customer, "fullName"),
    email: readField(customer, "email"),
    direction: readField(customer, "direction"),
  };
}

/**
 * Builds the compact currency nested in an order.
 * @param {object} currency - Currency instance or plain object.
 * @returns {{ id: number, code: string, name: string, symbol: string }}
 *   Public currency data.
 */
function toPublicCurrency(currency) {
  return {
    id: readField(currency, "id"),
    code: readField(currency, "code"),
    name: readField(currency, "name"),
    symbol: readField(currency, "symbol"),
  };
}

/**
 * Builds the actor nested in a history event for internal roles.
 * @param {object|null} actor - User instance or plain object.
 * @returns {{ id: number, username: string, email: string }|null} Actor data.
 */
function toPublicActor(actor) {
  if (!actor) {
    return null;
  }

  return {
    id: readField(actor, "id"),
    username: readField(actor, "username"),
    email: readField(actor, "email"),
  };
}

/**
 * Builds the product summary nested in an order line.
 * @param {object} product - Product instance or plain object.
 * @returns {{ id: number, name: string, reference: string,
 *   image_id: number }} Public product data.
 */
function toPublicProduct(product) {
  return {
    id: readField(product, "id"),
    name: readField(product, "name"),
    reference: readField(product, "reference"),
    image_id: readField(product, "image_id"),
  };
}

/**
 * Builds the item state summary nested in an order line.
 * @param {object} itemState - Item state instance or plain object.
 * @returns {{ id: number, name: string, label: string }} Public item state.
 */
function toPublicItemState(itemState) {
  return {
    id: readField(itemState, "id"),
    name: readField(itemState, "name"),
    label: readField(itemState, "label"),
  };
}

/**
 * Builds the payment term snapshot nested in an order.
 * @param {object} paymentTerm - Payment term instance or plain object.
 * @returns {{ id: number, code: string, name: string, days: number }}
 *   Public summary.
 */
function toPublicPaymentTerm(paymentTerm) {
  return {
    id: readField(paymentTerm, "id"),
    code: readField(paymentTerm, "code"),
    name: readField(paymentTerm, "name"),
    days: readField(paymentTerm, "days"),
  };
}

/**
 * Builds the public representation of one order line. Lot allocations, costs
 * and internal location fields are intentionally excluded.
 * @param {object} item - Order item instance or plain object.
 * @returns {object} Public line data.
 */
function toPublicOrderItem(item) {
  const product = readField(item, "product");
  const itemState = readField(item, "item_state");
  const data = {
    id: readField(item, "id"),
    product_id: readField(item, "product_id"),
    item_state_id: readField(item, "item_state_id"),
    quantity: readField(item, "quantity"),
    unit_price: toMoneyNumber(readField(item, "unit_price")),
    subtotal: toMoneyNumber(readField(item, "subtotal")),
    tax_id: readField(item, "tax_id"),
    tax_code: readField(item, "tax_code"),
    tax_name: readField(item, "tax_name"),
    tax_rate: toDecimalNumber(readField(item, "tax_rate"), 2),
    tax_amount: toMoneyNumber(readField(item, "tax_amount")),
    total: toMoneyNumber(readField(item, "total")),
  };

  if (itemState) {
    data.item_state = toPublicItemState(itemState);
  }

  if (product) {
    data.product = toPublicProduct(product);
  }

  return data;
}

/**
 * Builds the public representation of one history event.
 * @param {object} event - OrderHistory instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeActor] - Nest the internal actor.
 * @returns {object} Public event data.
 */
function toPublicOrderHistory(event, { includeActor = false } = {}) {
  const data = {
    event_type: readField(event, "event_type"),
    from_status: readField(event, "from_status"),
    to_status: readField(event, "to_status"),
    metadata: readField(event, "metadata") ?? null,
    created_at: toIso(readField(event, "createdAt")),
  };

  if (includeActor) {
    data.actor = toPublicActor(readField(event, "actor_user"));
  }

  return data;
}

/**
 * Builds the public representation of an order.
 * @param {object} order - Order instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeItems] - Nest the order lines.
 * @param {boolean} [options.includeHistory] - Nest the history events.
 * @param {boolean} [options.includeActor] - Nest history actors.
 * @param {boolean} [options.includeItemsCount] - Add `items_count`.
 * @returns {object} Public order data.
 */
function toPublicOrder(
  order,
  {
    includeItems = false,
    includeHistory = false,
    includeActor = false,
    includeItemsCount = false,
  } = {},
) {
  const customer = readField(order, "customer");
  const currency = readField(order, "currency");
  const items = readField(order, "items");
  const history = readField(order, "history");
  const paymentTerm = readField(order, "payment_term");
  const data = {
    id: readField(order, "id"),
    number: readField(order, "number"),
    status: readField(order, "status"),
    customer_id: readField(order, "customer_id"),
    user_id: readField(order, "user_id"),
    currency_id: readField(order, "currency_id"),
    subtotal: toMoneyNumber(readField(order, "subtotal")),
    tax_amount: toMoneyNumber(readField(order, "tax_amount")),
    total: toMoneyNumber(readField(order, "total")),
    payment_term_id: readField(order, "payment_term_id"),
    delivery_address: readField(order, "delivery_address"),
    notes: readField(order, "notes"),
    created_at: toIso(readField(order, "createdAt")),
  };

  if (currency) {
    data.currency = toPublicCurrency(currency);
  }

  if (customer) {
    data.customer = toPublicCustomer(customer);
  }

  if (paymentTerm) {
    data.payment_term = toPublicPaymentTerm(paymentTerm);
  }

  if (includeItems && Array.isArray(items)) {
    data.items = items.map((item) => toPublicOrderItem(item));
  }

  if (includeHistory && Array.isArray(history)) {
    data.history = history.map((event) =>
      toPublicOrderHistory(event, { includeActor }),
    );
  }

  if (includeItemsCount) {
    data.items_count = Array.isArray(items) ? items.length : 0;
  }

  return data;
}

module.exports = {
  toIso,
  toMoneyNumber,
  toPublicActor,
  toPublicCurrency,
  toPublicCustomer,
  toPublicItemState,
  toPublicOrder,
  toPublicOrderHistory,
  toPublicOrderItem,
  toPublicPaymentTerm,
  toPublicProduct,
};
