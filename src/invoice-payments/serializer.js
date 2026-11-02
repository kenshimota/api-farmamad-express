const { toPublicCurrencySummary } = require("../currencies/serializer");
const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Serializes a timestamp as an ISO string, keeping strings untouched.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The timestamp or null.
 */
function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Builds the common core of an allocation response.
 * @param {object} allocation - PaymentAllocation instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeInvoiceId] - Expose `invoice_id`.
 * @returns {object} The core allocation data.
 */
function toAllocationCore(allocation, { includeInvoiceId = false } = {}) {
  const payment = readField(allocation, "payment");
  const currency = payment ? readField(payment, "currency") : null;
  const data = {
    id: readField(allocation, "id"),
    payment_id: readField(allocation, "payment_id"),
  };

  if (includeInvoiceId) {
    data.invoice_id = readField(allocation, "invoice_id");
  }

  data.amount = toDecimalNumber(readField(allocation, "amount"), 2);
  data.currency = currency ? toPublicCurrencySummary(currency) : null;
  data.applied_amount = toDecimalNumber(
    readField(allocation, "applied_amount"),
    2,
  );
  data.exchange_rate = toDecimalNumber(
    readField(allocation, "exchange_rate"),
    6,
  );
  data.allocated_at = toIso(readField(allocation, "allocated_at"));

  return data;
}

/**
 * Builds the public representation of one allocation for the history listing,
 * including the payment method and type and, optionally, the staff author.
 * @param {object} allocation - PaymentAllocation instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeCreatedBy] - Expose `created_by`.
 * @returns {object} Public allocation.
 */
function toPublicAllocation(allocation, { includeCreatedBy = false } = {}) {
  const payment = readField(allocation, "payment");
  const method = payment ? readField(payment, "method_payment") : null;
  const methodType = method ? readField(method, "method_payment_type") : null;
  const data = {
    ...toAllocationCore(allocation),
    method_payment: method
      ? {
          id: readField(method, "id"),
          label: readField(method, "label"),
        }
      : null,
    method_payment_type: methodType
      ? {
          id: readField(methodType, "id"),
          code: readField(methodType, "code"),
          name: readField(methodType, "name"),
        }
      : null,
  };

  if (includeCreatedBy) {
    const user = readField(allocation, "created_by");

    data.created_by = user
      ? {
          id: readField(user, "id"),
          username: readField(user, "username"),
          email: readField(user, "email"),
        }
      : null;
  }

  return data;
}

/**
 * Builds the compact invoice returned with a new allocation.
 * @param {object} invoice - Updated invoice instance.
 * @returns {object} Invoice summary with the payment state.
 */
function toPublicInvoiceSummary(invoice) {
  const total = toDecimalNumber(readField(invoice, "total"), 2);
  const paidAmount = toDecimalNumber(readField(invoice, "paid_amount"), 2);
  const balanceDue =
    total === null || paidAmount === null
      ? null
      : Number((total - paidAmount).toFixed(2));

  return {
    id: readField(invoice, "id"),
    number: readField(invoice, "number"),
    total,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    payment_status: readField(invoice, "payment_status"),
  };
}

/**
 * Builds the `201` response of the apply endpoint: the allocation plus the
 * updated invoice summary.
 * @param {object} allocation - Created allocation with its payment.
 * @param {object} invoice - Updated invoice.
 * @returns {object} Public creation response.
 */
function toPublicAllocationWithInvoice(allocation, invoice) {
  return {
    ...toAllocationCore(allocation, { includeInvoiceId: true }),
    invoice: toPublicInvoiceSummary(invoice),
  };
}

module.exports = {
  toPublicAllocation,
  toPublicAllocationWithInvoice,
  toPublicInvoiceSummary,
};
