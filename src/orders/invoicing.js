const { readField } = require("../shared/serializer");
const { EVENTS, ORDER_STATUSES } = require("./constants");
const { invoiceService } = require("../invoices/service");

/**
 * Creates the invoicing side effect of the `generate → invoiced` transition.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {object} dependencies.reservation - Reservation service.
 * @param {object} dependencies.history - History service.
 * @param {object} [dependencies.invoices] - Invoice service.
 * @returns {object} The invoicing service.
 */
function createOrderInvoicingService({
  repository,
  reservation,
  history,
  invoices = invoiceService,
}) {
  /**
   * Builds the invoice snapshot from the order lines.
   * @param {object} order - Loaded order.
   * @param {number} actorUserId - Authenticated user id.
   * @returns {object} Invoice input.
   */
  function buildInvoiceInput(order, actorUserId) {
    return {
      order_id: readField(order, "id"),
      customer_id: readField(order, "customer_id"),
      invoiced_by_user_id: actorUserId,
      currency_id: readField(order, "currency_id"),
      payment_term_id: readField(order, "payment_term_id"),
      subtotal: Number(readField(order, "subtotal")),
      tax_amount: Number(readField(order, "tax_amount")),
      total: Number(readField(order, "total")),
      notes: null,
      items: order.items.map((item) => ({
        order_item_id: readField(item, "id"),
        product_id: readField(item, "product_id"),
        product_name: readField(readField(item, "product"), "name"),
        product_reference: readField(readField(item, "product"), "reference"),
        item_state_id: readField(item, "item_state_id"),
        item_state_name: readField(readField(item, "item_state"), "name"),
        quantity: readField(item, "quantity"),
        unit_price: Number(readField(item, "unit_price")),
        subtotal: Number(readField(item, "subtotal")),
        tax_id: readField(item, "tax_id"),
        tax_code: readField(item, "tax_code"),
        tax_name: readField(item, "tax_name"),
        tax_rate: Number(readField(item, "tax_rate")),
        tax_amount: Number(readField(item, "tax_amount")),
        total: Number(readField(item, "total")),
      })),
    };
  }

  return {
    /**
     * Issues the invoice, consumes the reservation, changes the status and
     * appends both `status_changed` and `invoice_issued` events.
     * @param {object} order - Locked order with its lines.
     * @param {object} context - Actor context.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The created invoice.
     */
    async invoice(order, context, transaction) {
      const fromStatus = readField(order, "status");
      const invoice = await invoices.createInvoiceInTransaction(
        buildInvoiceInput(order, context.userId),
        transaction,
      );

      await reservation.consume(order, transaction);
      await repository.updateOrder(
        order,
        { status: ORDER_STATUSES.INVOICED },
        { transaction },
      );
      await history.append(
        {
          orderId: readField(order, "id"),
          eventType: EVENTS.STATUS_CHANGED,
          fromStatus,
          toStatus: ORDER_STATUSES.INVOICED,
          actorUserId: context.userId,
        },
        transaction,
      );
      await history.append(
        {
          orderId: readField(order, "id"),
          eventType: EVENTS.INVOICE_ISSUED,
          fromStatus,
          toStatus: ORDER_STATUSES.INVOICED,
          actorUserId: context.userId,
          metadata: {
            invoice_id: readField(invoice, "id"),
            invoice_number: readField(invoice, "number"),
          },
        },
        transaction,
      );

      return invoice;
    },
  };
}

module.exports = { createOrderInvoicingService };
