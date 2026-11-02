const { readField } = require("../shared/serializer");
const { resolveDefaultTransactionCurrency } = require("../currencies/default");
const { assertAssignablePaymentTerm } = require("../payment-terms/assignment");
const { EVENTS, ORDER_STATUSES } = require("./constants");
const { orderNotFound, orderNotEditable } = require("./errors");
const {
  assertNoDuplicates,
  normalizeAddress,
  normalizeNotes,
} = require("./service-support");
const {
  calculateOrderTotals,
  toLineAmounts,
  toOrderAmounts,
} = require("./money");

/**
 * Creates the draft service: creates editable orders and updates their header.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {object} dependencies.access - Access helpers.
 * @param {object} dependencies.pricing - Pricing helper.
 * @param {object} dependencies.history - History helper.
 * @param {Function} [dependencies.resolveTransactionCurrency] - Default
 *   transaction currency resolver.
 * @param {Function} [dependencies.assertTerm] - Payment term validator.
 * @returns {object} The draft service.
 */
function createOrderDraftService({
  repository,
  access,
  pricing,
  history,
  resolveTransactionCurrency = resolveDefaultTransactionCurrency,
  assertTerm = assertAssignablePaymentTerm,
}) {
  /**
   * Resolves the payment term snapshot of a new order. Customers copy their
   * profile term; admins and sellers may send another active term or copy the
   * customer one. A null term is accepted because the order is a draft.
   * @param {object} input - Validated body.
   * @param {object} customer - Target customer.
   * @param {object} context - Actor context.
   * @returns {Promise<number|null>} The active term id or null.
   */
  async function resolvePaymentTerm(input, customer, context) {
    const customerTermId = readField(customer, "payment_term_id") ?? null;
    const requestedTermId =
      context.role === "customer"
        ? customerTermId
        : (input.payment_term_id ?? customerTermId);

    if (requestedTermId === null) {
      return null;
    }

    const term = await assertTerm(requestedTermId);

    return Number(readField(term, "id"));
  }

  return {
    /**
     * Creates a draft order. Prices are snapshotted but stock is not reserved.
     * @param {object} input - Validated body.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The created order.
     */
    async createDraft(input, actor) {
      const context = await access.resolveContext(actor);
      const target = await access.resolveCreateCustomer(input, context);
      const paymentTermId = await resolvePaymentTerm(
        input,
        target.customer,
        context,
      );
      const currency = await resolveTransactionCurrency();
      const lines = input.items ?? [];

      assertNoDuplicates(lines);

      return repository.transaction(async (transaction) => {
        const pricedLines = await pricing.priceLines(
          lines,
          target.priceListId,
          currency,
        );
        const totals = calculateOrderTotals(pricedLines);
        const number = await repository.nextNumber(transaction);
        const order = await repository.createOrder(
          {
            number,
            customer_id: target.customerId,
            user_id: context.userId,
            currency_id: readField(currency, "id"),
            status: ORDER_STATUSES.DRAFT,
            payment_term_id: paymentTermId,
            ...toOrderAmounts(totals),
            delivery_address: normalizeAddress(
              input.delivery_address,
              target.customer,
            ),
            notes: normalizeNotes(input.notes),
          },
          { transaction },
        );

        if (pricedLines.length > 0) {
          await repository.createItems(
            pricedLines.map((line) => ({
              order_id: order.id,
              product_id: line.product_id,
              item_state_id: line.item_state_id,
              quantity: line.quantity,
              ...toLineAmounts(line),
            })),
            { transaction },
          );
        }

        await history.append(
          {
            orderId: order.id,
            eventType: EVENTS.CREATED,
            fromStatus: null,
            toStatus: ORDER_STATUSES.DRAFT,
            actorUserId: context.userId,
          },
          transaction,
        );

        return repository.findById(order.id, { transaction });
      });
    },

    /**
     * Replaces the address and notes of a draft order.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated body.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updateHeader(orderId, input, actor) {
      const context = await access.resolveContext(actor);

      return repository.transaction(async (transaction) => {
        const order = await repository.findById(orderId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!order) {
          throw orderNotFound();
        }

        await access.assertEditAccess(order, context);

        if (readField(order, "status") !== ORDER_STATUSES.DRAFT) {
          throw orderNotEditable();
        }

        const values = {};
        const customer = readField(order, "customer");

        if (Object.prototype.hasOwnProperty.call(input, "delivery_address")) {
          values.delivery_address = normalizeAddress(
            input.delivery_address,
            customer,
          );
        }

        if (Object.prototype.hasOwnProperty.call(input, "notes")) {
          values.notes = normalizeNotes(input.notes);
        }

        if (Object.keys(values).length > 0) {
          await repository.updateOrder(order, values, { transaction });
        }

        return repository.findById(orderId, { transaction });
      });
    },
  };
}

module.exports = { createOrderDraftService };
