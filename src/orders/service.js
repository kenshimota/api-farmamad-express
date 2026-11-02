const { resolvePrice } = require("../pricing");
const { readField } = require("../shared/serializer");
const { resolveDefaultTransactionCurrency } = require("../currencies/default");
const { orderRepository } = require("./repository");
const { planLotAllocations } = require("./reservation");
const {
  assertNoDuplicates,
  normalizeAddress,
  normalizeNotes,
  translatePricingError,
} = require("./service-support");
const {
  customerProfileNotLinked,
  forbidden,
  insufficientStock,
  priceListNotAssigned,
  unauthorized,
} = require("./errors");
const {
  calculateOrderTotals,
  toLineAmounts,
  toOrderAmounts,
} = require("./money");

const CUSTOMER_ROLE = "customer";
const PENDING_STATUS = "pending";
const CREATED_EVENT = "created";

/**
 * Creates the orders service. Every business rule lives here so the router only
 * parses, authorizes and serializes. The repository, price resolver, currency
 * resolver and clock are injectable for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Order repository.
 * @param {Function} [dependencies.priceResolver] - Shared pricing resolver.
 * @param {Function} [dependencies.resolveTransactionCurrency] - Default
 *   transaction currency resolver.
 * @returns {object} The orders service.
 */
function createOrderService({
  repository = orderRepository,
  priceResolver = resolvePrice,
  resolveTransactionCurrency = resolveDefaultTransactionCurrency,
} = {}) {
  /**
   * Resolves the authenticated customer and its price list.
   * @param {object} actor - JWT payload.
   * @returns {Promise<{ user: object, customer: object, priceListId: number }>}
   *   The customer context.
   */
  async function resolveCustomer(actor) {
    if (!actor || actor.role !== CUSTOMER_ROLE) {
      throw forbidden();
    }

    const user = await repository.findUserById(actor.sub);

    if (!user) {
      throw unauthorized();
    }

    const customerId = readField(user, "customer_id");

    if (customerId === null || customerId === undefined) {
      throw customerProfileNotLinked();
    }

    const customer = await repository.findCustomerById(customerId);

    if (!customer) {
      throw customerProfileNotLinked();
    }

    const priceListId = readField(customer, "price_list_id");

    if (priceListId === null || priceListId === undefined) {
      throw priceListNotAssigned();
    }

    return {
      user,
      customer,
      priceListId,
      customerId: Number(customerId),
    };
  }

  return {
    /**
     * Creates a customer order atomically: resolves and snapshots every price,
     * reserves the lots FEFO with row locks, persists the header, lines,
     * allocations and the initial `created` history event.
     * @param {object} input - Validated request body.
     * @param {object} actor - Authenticated JWT payload.
     * @returns {Promise<object>} The created order with public relations.
     * @throws {Error} 401/403/409/422/503 controlled HTTP errors.
     */
    async createOrder(input, actor) {
      const lines = input.items;

      assertNoDuplicates(lines);

      const { user, customer, priceListId, customerId } =
        await resolveCustomer(actor);
      const transactionCurrency = await resolveTransactionCurrency();

      return repository.transaction(async (transaction) => {
        const pricedLines = [];

        for (const line of lines) {
          try {
            const resolved = await priceResolver({
              product_id: line.product_id,
              item_state_id: line.item_state_id,
              price_list_id: priceListId,
              transactionCurrency,
            });

            pricedLines.push({ ...line, unit_price: resolved.price });
          } catch (error) {
            throw translatePricingError(error, line);
          }
        }

        const missing = [];
        const reservations = [];

        for (const line of pricedLines) {
          const lots = await repository.findLotsForUpdate(
            line.product_id,
            line.item_state_id,
            transaction,
          );
          const plan = planLotAllocations(lots, line.quantity);

          if (plan.remaining > 0) {
            missing.push({
              product_id: line.product_id,
              item_state_id: line.item_state_id,
            });
            continue;
          }

          reservations.push({ line, allocations: plan.allocations });
        }

        if (missing.length > 0) {
          throw insufficientStock(missing);
        }

        for (const reservation of reservations) {
          for (const allocation of reservation.allocations) {
            await repository.reserveLot(
              allocation.lot,
              allocation.quantity,
              transaction,
            );
          }
        }

        const totals = calculateOrderTotals(pricedLines);
        const number = await repository.nextNumber(transaction);
        const order = await repository.createOrder(
          {
            number,
            customer_id: customerId,
            user_id: readField(user, "id"),
            currency_id: readField(transactionCurrency, "id"),
            status: PENDING_STATUS,
            ...toOrderAmounts(totals),
            delivery_address: normalizeAddress(
              input.delivery_address,
              customer,
            ),
            notes: normalizeNotes(input.notes),
          },
          { transaction },
        );
        const items = await repository.createItems(
          pricedLines.map((line) => ({
            order_id: order.id,
            product_id: line.product_id,
            item_state_id: line.item_state_id,
            quantity: line.quantity,
            ...toLineAmounts(line),
          })),
          { transaction },
        );

        for (const [index, item] of items.entries()) {
          const allocations = reservations[index].allocations;

          await repository.createAllocations(
            allocations.map((allocation) => ({
              order_item_id: item.id,
              lot_id: allocation.lot.id,
              quantity: allocation.quantity,
              status: "reserved",
            })),
            { transaction },
          );
        }

        await repository.createHistory(
          {
            order_id: order.id,
            event_type: CREATED_EVENT,
            from_status: null,
            to_status: PENDING_STATUS,
            actor_user_id: readField(user, "id"),
            metadata: null,
          },
          { transaction },
        );

        return repository.findById(order.id, { transaction });
      });
    },
  };
}

const orderService = createOrderService();

module.exports = {
  CREATED_EVENT,
  CUSTOMER_ROLE,
  PENDING_STATUS,
  createOrderService,
  orderService,
};
