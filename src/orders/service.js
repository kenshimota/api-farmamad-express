const { resolvePrice } = require("../pricing");
const { resolveDefaultTransactionCurrency } = require("../currencies/default");
const { assertAssignablePaymentTerm } = require("../payment-terms/assignment");
const { orderStatusService } = require("../order-statuses/service");
const { invoiceService } = require("../invoices/service");
const { orderRepository } = require("./repository");
const { createOrderAccess } = require("./access");
const { createOrderPricingService } = require("./pricing-service");
const { createOrderHistoryService } = require("./history-service");
const { createLotReservationService } = require("./lot-reservation-service");
const { createOrderDraftService } = require("./draft");
const { createOrderItemService } = require("./items");
const { createOrderInvoicingService } = require("./invoicing");
const { createOrderCancellationService } = require("./cancellation");
const { createOrderTransitionService } = require("./transitions");
const { createOrderPaymentTermService } = require("./payment-term-service");
const { orderNotFound } = require("./errors");
const { CUSTOMER_ROLE, ORDER_STATUSES } = require("./constants");

/**
 * Creates the orders service facade. It wires the focused services and exposes
 * the operations consumed by the routers.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Orders repository.
 * @param {object} [dependencies.statusService] - Order status service.
 * @param {Function} [dependencies.priceResolver] - Shared price resolver.
 * @param {Function} [dependencies.resolveTransactionCurrency] - Currency
 *   resolver.
 * @param {Function} [dependencies.assertTerm] - Payment term validator.
 * @param {object} [dependencies.invoices] - Invoice service.
 * @returns {object} The orders service.
 */
function createOrderService({
  repository = orderRepository,
  statusService = orderStatusService,
  priceResolver = resolvePrice,
  resolveTransactionCurrency = resolveDefaultTransactionCurrency,
  assertTerm = assertAssignablePaymentTerm,
  invoices = invoiceService,
} = {}) {
  const access = createOrderAccess({ repository });
  const pricing = createOrderPricingService({
    repository,
    priceResolver,
    resolveTransactionCurrency,
  });
  const history = createOrderHistoryService({ repository });
  const reservation = createLotReservationService({ repository });
  const draft = createOrderDraftService({
    repository,
    access,
    pricing,
    history,
    resolveTransactionCurrency,
    assertTerm,
  });
  const items = createOrderItemService({
    repository,
    access,
    pricing,
    history,
  });
  const invoicing = createOrderInvoicingService({
    repository,
    reservation,
    history,
    invoices,
  });
  const cancellation = createOrderCancellationService({
    repository,
    reservation,
    history,
  });
  const transitions = createOrderTransitionService({
    repository,
    access,
    pricing,
    reservation,
    history,
    invoicing,
    cancellation,
  });
  const paymentTerms = createOrderPaymentTermService({
    repository,
    access,
    assertTerm,
  });

  /**
   * Fails when the five base statuses are missing.
   * @returns {Promise<void>}
   */
  function assertStatusConfiguration() {
    return statusService.assertComplete();
  }

  return {
    /**
     * Creates a draft order for a customer, admin or assigned seller.
     * @param {object} input - Validated body.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The created order.
     */
    async createOrder(input, actor) {
      await assertStatusConfiguration();
      return draft.createDraft(input, actor);
    },

    /**
     * Replaces the address and notes of a draft order.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated body.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updateOrder(orderId, input, actor) {
      return draft.updateHeader(orderId, input, actor);
    },

    /**
     * Adds a line to a draft order.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated line.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async addItem(orderId, input, actor) {
      await assertStatusConfiguration();
      return items.addItem(orderId, input, actor);
    },

    /**
     * Updates the quantity of a draft line.
     * @param {number} orderId - Order id.
     * @param {number} itemId - Line id.
     * @param {object} input - Validated body.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updateItem(orderId, itemId, input, actor) {
      await assertStatusConfiguration();
      return items.updateItem(orderId, itemId, input, actor);
    },

    /**
     * Removes a line from a draft order.
     * @param {number} orderId - Order id.
     * @param {number} itemId - Line id.
     * @param {object} actor - JWT payload.
     * @returns {Promise<void>}
     */
    async removeItem(orderId, itemId, actor) {
      await assertStatusConfiguration();
      return items.removeItem(orderId, itemId, actor);
    },

    /**
     * Applies one status transition.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated body with `status`.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updateStatus(orderId, input, actor) {
      await assertStatusConfiguration();
      return transitions.updateStatus(orderId, input, actor);
    },

    /**
     * Replaces the payment term of a draft or requested order.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated body.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updatePaymentTerm(orderId, input, actor) {
      return paymentTerms.updatePaymentTerm(orderId, input, actor);
    },

    /**
     * Lists the orders visible to the actor.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object[]>} The orders.
     */
    async listOrders(actor) {
      const context = await access.resolveContext(actor);

      return repository.findOrders({
        customerId:
          context.role === CUSTOMER_ROLE ? context.customerId : undefined,
      });
    },

    /**
     * Loads one order applying the visibility rule.
     * @param {number} orderId - Order id.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The order.
     */
    async getOrder(orderId, actor) {
      const context = await access.resolveContext(actor);
      const order = await repository.findById(orderId);

      if (!order) {
        throw orderNotFound();
      }

      access.assertViewAccess(order, context);

      return { order, context };
    },

    /**
     * Loads the invoice of an order applying the order visibility rule.
     * @param {number} orderId - Order id.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The invoice.
     */
    async getInvoiceByOrder(orderId, actor) {
      const context = await access.resolveContext(actor);
      const order = await repository.findById(orderId, {
        includeItems: false,
        includeHistory: false,
      });

      if (!order) {
        throw orderNotFound();
      }

      access.assertViewAccess(order, context);

      return invoices.getInvoiceByOrder(orderId, actor);
    },
  };
}

const orderService = createOrderService();

module.exports = {
  CUSTOMER_ROLE,
  ORDER_STATUSES,
  createOrderService,
  orderService,
};
