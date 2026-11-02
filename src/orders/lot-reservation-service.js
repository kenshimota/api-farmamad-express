const { readField } = require("../shared/serializer");
const { insufficientStock } = require("./errors");
const { planLotAllocations } = require("./reservation");

/**
 * Creates the reservation service that reserves, releases and consumes lots for
 * an order. Every method runs inside the caller transaction so the transition
 * stays atomic.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @returns {object} The reservation service.
 */
function createLotReservationService({ repository }) {
  /**
   * Reserves the order lines FEFO. The plan is built for every line before
   * touching `lots.reserved`, so a missing line aborts the whole transaction.
   * @param {object} order - Loaded order with its lines.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   * @throws {Error} 409 with every line that lacks stock.
   */
  async function reserve(order, transaction) {
    const missing = [];
    const reservations = [];

    for (const item of order.items) {
      const lots = await repository.findLotsForUpdate(
        readField(item, "product_id"),
        readField(item, "item_state_id"),
        transaction,
      );
      const plan = planLotAllocations(lots, readField(item, "quantity"));

      if (plan.remaining > 0) {
        missing.push({
          product_id: readField(item, "product_id"),
          item_state_id: readField(item, "item_state_id"),
        });
        continue;
      }

      reservations.push({ item, allocations: plan.allocations });
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

      await repository.createAllocations(
        reservation.allocations.map((allocation) => ({
          order_item_id: readField(reservation.item, "id"),
          lot_id: allocation.lot.id,
          quantity: allocation.quantity,
          status: "reserved",
        })),
        { transaction },
      );
    }
  }

  /**
   * Loads and locks the active allocations and their lots.
   * @param {number} orderId - Order id.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<{ allocations: object[], lots: Map<number, object> }>}
   *   Allocations and their locked lots.
   */
  async function lockReservations(orderId, transaction) {
    const allocations = await repository.findReservedAllocations(
      orderId,
      transaction,
    );
    const lotIds = [
      ...new Set(
        allocations.map((allocation) => readField(allocation, "lot_id")),
      ),
    ];
    const lockedLots = await repository.lockLots(lotIds, transaction);

    return {
      allocations,
      lots: new Map(lockedLots.map((lot) => [Number(lot.id), lot])),
    };
  }

  /**
   * Releases the active reservations without touching physical stock.
   * @param {number} orderId - Order id.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function release(orderId, transaction) {
    const { allocations, lots } = await lockReservations(orderId, transaction);

    for (const allocation of allocations) {
      const quantity = Number(readField(allocation, "quantity"));
      const lot = lots.get(Number(readField(allocation, "lot_id")));

      if (lot) {
        await repository.updateLot(
          lot,
          { reserved: Math.max(0, Number(lot.reserved) - quantity) },
          transaction,
        );
      }

      await repository.updateAllocation(
        allocation,
        { status: "released" },
        transaction,
      );
    }
  }

  /**
   * Consumes the active reservations when the order is invoiced. It decrements
   * `lots.reserved`, `lots.stock` and the aggregate `stocks.quantity`.
   * @param {object} order - Loaded order with its lines.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function consume(order, transaction) {
    const { allocations, lots } = await lockReservations(
      readField(order, "id"),
      transaction,
    );

    for (const allocation of allocations) {
      const quantity = Number(readField(allocation, "quantity"));
      const lotId = Number(readField(allocation, "lot_id"));
      const lot = lots.get(lotId);

      if (lot) {
        await repository.updateLot(
          lot,
          {
            reserved: Math.max(0, Number(lot.reserved) - quantity),
            stock: Math.max(0, Number(lot.stock) - quantity),
          },
          transaction,
        );
      }

      await repository.updateAllocation(
        allocation,
        { status: "consumed" },
        transaction,
      );
    }

    for (const item of order.items) {
      const stock = await repository.findStockForUpdate(
        readField(item, "product_id"),
        readField(item, "item_state_id"),
        transaction,
      );

      if (stock) {
        await repository.updateStock(
          stock,
          Math.max(
            0,
            Number(readField(stock, "quantity")) -
              Number(readField(item, "quantity")),
          ),
          transaction,
        );
      }
    }
  }

  return { consume, release, reserve };
}

module.exports = { createLotReservationService };
