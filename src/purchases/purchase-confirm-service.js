const {
  httpError,
  notEditable,
  purchaseHasNoItems,
  purchaseNotFound,
} = require("./errors");
const { calculateTotals, toDecimal } = require("./money");

/**
 * Creates the confirmation operation of the purchases service.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Purchase repository.
 * @param {object} dependencies.itemRepository - Purchase item repository.
 * @param {object} dependencies.stocks - Stock purchase service.
 * @param {object} dependencies.support - Shared service helpers.
 * @param {function(): Date} dependencies.clock - Clock for confirmed_at.
 * @returns {object} The confirmation operation.
 */
function createPurchaseConfirmOperations({
  repository,
  itemRepository,
  stocks,
  support,
  clock,
}) {
  return {
    /**
     * Confirms a draft atomically: recalculates the totals, upserts `costs`,
     * increments `stocks` through the stock purchase service and marks the
     * purchase as confirmed. Any failure rolls the whole transaction back.
     * @param {number} id - Purchase id.
     * @returns {Promise<object>} The confirmed purchase.
     */
    async confirmPurchase(id) {
      return repository.transaction(async (transaction) => {
        const purchase = await repository.findByIdForUpdate(id, transaction);

        if (!purchase) {
          throw purchaseNotFound();
        }

        if (purchase.status === "confirmed") {
          throw httpError(409, { message: "Purchase already confirmed" });
        }

        if (purchase.status !== "draft") {
          throw notEditable();
        }

        const lines = await itemRepository.list(id, { transaction });

        if (lines.length === 0) {
          throw purchaseHasNoItems();
        }

        await support.assertSupplier(purchase.supplier_id);
        await support.assertItemReferences(lines, "items");

        const totals = calculateTotals(lines, purchase.tax_rate);

        await repository.update(
          purchase,
          {
            subtotal: toDecimal(totals.subtotal),
            tax_amount: toDecimal(totals.tax_amount),
            total: toDecimal(totals.total),
          },
          { transaction },
        );

        for (const line of lines) {
          await repository.upsertCost(
            {
              product_id: line.product_id,
              item_state_id: line.item_state_id,
              unit_cost: line.unit_cost,
            },
            { transaction },
          );
        }

        await stocks.applyPurchaseItems(lines, { transaction });

        await repository.update(
          purchase,
          { status: "confirmed", confirmed_at: clock() },
          { transaction },
        );

        return support.reload(id, transaction, { includeSupplier: true });
      });
    },
  };
}

module.exports = { createPurchaseConfirmOperations };
