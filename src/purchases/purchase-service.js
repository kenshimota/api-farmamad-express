const { purchaseRepository } = require("./repository");
const { purchaseItemRepository } = require("./item-repository");
const { stockRepository } = require("../stocks/repository");
const { resolveDefaultTaxRate } = require("./validators");
const { resolveTransactionCurrency } = require("../currencies/default");
const { purchaseNotFound } = require("./errors");
const {
  calculateLineSubtotal,
  calculateTotals,
  toDecimal,
} = require("./money");
const { createServiceSupport } = require("./service-support");
const { createPurchaseItemOperations } = require("./purchase-item-service");
const {
  createPurchaseConfirmOperations,
} = require("./purchase-confirm-service");

/**
 * Creates the purchases service. Every business rule lives here so the routers
 * only parse, authorize and serialize. The repositories, the stock service and
 * the clock are injectable for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Purchase repository.
 * @param {object} [dependencies.itemRepository] - Purchase item repository.
 * @param {object} [dependencies.stocks] - Stock purchase service.
 * @param {function(): Date} [dependencies.clock] - Clock used for confirmed_at.
 * @returns {object} The purchases service.
 */
function createPurchaseService({
  repository = purchaseRepository,
  itemRepository = purchaseItemRepository,
  stocks = stockRepository,
  clock = () => new Date(),
} = {}) {
  const support = createServiceSupport({ repository, itemRepository });

  return {
    ...createPurchaseItemOperations({
      repository,
      itemRepository,
      support,
    }),
    ...createPurchaseConfirmOperations({
      repository,
      itemRepository,
      stocks,
      support,
      clock,
    }),

    /**
     * Lists purchases ordered by number descending.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching purchases.
     */
    listPurchases(filters) {
      return repository.list(filters);
    },

    /**
     * Returns one purchase with its lines and nested supplier.
     * @param {number} id - Purchase id.
     * @returns {Promise<object>} The purchase.
     * @throws {Error} 404 when it does not exist.
     */
    async getPurchase(id) {
      const purchase = await repository.findById(id, {
        includeItems: true,
        includeSupplier: true,
      });

      if (!purchase) {
        throw purchaseNotFound();
      }

      return purchase;
    },

    /**
     * Creates a draft purchase, assigns its number and calculates its totals.
     * @param {object} input - Validated supplier, tax rate, notes and lines.
     * @returns {Promise<object>} The created purchase with its lines.
     */
    async createPurchase(input) {
      const lines = input.items ?? [];
      const taxRate = input.tax_rate ?? resolveDefaultTaxRate();

      support.assertNoDuplicates(lines);
      await support.assertSupplier(input.supplier_id);
      await support.assertItemReferences(lines, "items");
      const currency = await resolveTransactionCurrency(input.currency_id);

      return repository.transaction(async (transaction) => {
        const totals = calculateTotals(lines, taxRate);
        const number = await repository.nextNumber(transaction);
        const purchase = await repository.create(
          {
            number,
            supplier_id: input.supplier_id,
            currency_id: currency.id,
            status: "draft",
            subtotal: toDecimal(totals.subtotal),
            tax_rate: toDecimal(taxRate),
            tax_amount: toDecimal(totals.tax_amount),
            total: toDecimal(totals.total),
            notes: input.notes ?? null,
          },
          { transaction },
        );

        if (lines.length > 0) {
          await itemRepository.createMany(
            lines.map((line) => ({
              purchase_id: purchase.id,
              product_id: line.product_id,
              item_state_id: line.item_state_id,
              quantity: line.quantity,
              unit_cost: toDecimal(line.unit_cost),
              subtotal: toDecimal(
                calculateLineSubtotal(line.quantity, line.unit_cost),
              ),
            })),
            { transaction },
          );
        }

        return support.reload(purchase.id, transaction);
      });
    },

    /**
     * Updates the supplier, tax rate and/or notes of a draft and recalculates
     * its totals.
     * @param {number} id - Purchase id.
     * @param {object} changes - Validated changes.
     * @returns {Promise<object>} The updated purchase with its lines.
     */
    async updatePurchase(id, changes) {
      return repository.transaction(async (transaction) => {
        const purchase = await support.loadDraft(id, transaction);
        const updates = { ...changes };

        if (changes.supplier_id !== undefined) {
          await support.assertSupplier(changes.supplier_id);
        }

        if (changes.currency_id !== undefined) {
          const currency = await resolveTransactionCurrency(
            changes.currency_id,
          );

          updates.currency_id = currency.id;
        }

        const taxRate = changes.tax_rate ?? purchase.tax_rate;
        const totals = calculateTotals(
          await itemRepository.list(id, { transaction }),
          taxRate,
        );

        await repository.update(
          purchase,
          {
            ...updates,
            tax_rate: toDecimal(taxRate),
            subtotal: toDecimal(totals.subtotal),
            tax_amount: toDecimal(totals.tax_amount),
            total: toDecimal(totals.total),
          },
          { transaction },
        );

        return support.reload(id, transaction);
      });
    },

    /**
     * Deletes a draft purchase; the database cascades its lines.
     * @param {number} id - Purchase id.
     * @returns {Promise<void>} Resolves once it is deleted.
     */
    async deletePurchase(id) {
      return repository.transaction(async (transaction) => {
        const purchase = await support.loadDraft(id, transaction);

        await repository.remove(purchase, { transaction });
      });
    },

    /**
     * Cancels a draft purchase without touching costs or stocks.
     * @param {number} id - Purchase id.
     * @returns {Promise<object>} The cancelled purchase with its lines.
     */
    async cancelPurchase(id) {
      return repository.transaction(async (transaction) => {
        const purchase = await support.loadDraft(id, transaction);

        await repository.update(
          purchase,
          { status: "cancelled" },
          { transaction },
        );

        return support.reload(id, transaction);
      });
    },
  };
}

const purchaseService = createPurchaseService();

module.exports = { createPurchaseService, purchaseService };
