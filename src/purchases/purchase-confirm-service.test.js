const {
  createPurchaseConfirmOperations,
} = require("./purchase-confirm-service");
const { createServiceSupport } = require("./service-support");
const {
  TRANSACTION,
  itemRepositoryDouble,
  repositoryDouble,
  stocksDouble,
} = require("../../test/helpers/purchase-service-doubles");

const CLOCK = new Date("2026-10-29T10:00:00Z");

/**
 * Builds the confirmation operation with fresh doubles.
 * @returns {object} Operations and doubles.
 */
function setup() {
  const repository = repositoryDouble();
  const itemRepository = itemRepositoryDouble();
  const stocks = stocksDouble();
  const support = createServiceSupport({ repository, itemRepository });
  const operations = createPurchaseConfirmOperations({
    repository,
    itemRepository,
    stocks,
    support,
    clock: () => CLOCK,
  });

  return { operations, repository, itemRepository, stocks };
}

/**
 * Builds a stored purchase.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Purchase double.
 */
function purchase(overrides = {}) {
  return {
    id: 1,
    number: 1,
    supplier_id: 2,
    status: "draft",
    subtotal: "0.00",
    tax_rate: "16.00",
    tax_amount: "0.00",
    total: "0.00",
    ...overrides,
  };
}

const LINES = [
  {
    id: 1,
    product_id: 15,
    item_state_id: 1,
    quantity: 40,
    unit_cost: "20.00",
    subtotal: "800.00",
  },
  {
    id: 2,
    product_id: 15,
    item_state_id: 2,
    quantity: 3,
    unit_cost: "12.50",
    subtotal: "37.50",
  },
];

describe("confirmPurchase", () => {
  it("recalculates, upserts costs, increments stocks and confirms", async () => {
    const { operations, repository, itemRepository, stocks } = setup();
    const stored = purchase();
    repository.findByIdForUpdate.mockResolvedValue(stored);
    repository.findById.mockResolvedValue(stored);
    itemRepository.list.mockResolvedValue(LINES);

    await operations.confirmPurchase(1);

    expect(repository.update).toHaveBeenNthCalledWith(
      1,
      stored,
      { subtotal: "837.50", tax_amount: "134.00", total: "971.50" },
      { transaction: TRANSACTION },
    );
    expect(repository.upsertCost).toHaveBeenNthCalledWith(
      1,
      { product_id: 15, item_state_id: 1, unit_cost: "20.00" },
      { transaction: TRANSACTION },
    );
    expect(repository.upsertCost).toHaveBeenNthCalledWith(
      2,
      { product_id: 15, item_state_id: 2, unit_cost: "12.50" },
      { transaction: TRANSACTION },
    );
    expect(stocks.applyPurchaseItems).toHaveBeenCalledWith(LINES, {
      transaction: TRANSACTION,
    });
    expect(repository.update).toHaveBeenNthCalledWith(
      2,
      stored,
      { status: "confirmed", confirmed_at: CLOCK },
      { transaction: TRANSACTION },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      includeItems: true,
      includeSupplier: true,
      transaction: TRANSACTION,
    });
  });

  it("answers 404 for an unknown purchase", async () => {
    const { operations, repository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(null);

    await expect(operations.confirmPurchase(99)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("answers 409 when it is already confirmed", async () => {
    const { operations, repository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(
      purchase({ status: "confirmed" }),
    );

    await expect(operations.confirmPurchase(1)).rejects.toMatchObject({
      status: 409,
      body: { message: "Purchase already confirmed" },
    });
  });

  it("answers 409 when it was cancelled", async () => {
    const { operations, repository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(
      purchase({ status: "cancelled" }),
    );

    await expect(operations.confirmPurchase(1)).rejects.toMatchObject({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
  });

  it("answers 422 when the purchase has no lines", async () => {
    const { operations, repository, itemRepository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.list.mockResolvedValue([]);

    await expect(operations.confirmPurchase(1)).rejects.toMatchObject({
      status: 422,
      body: { message: "Purchase has no items" },
    });
    expect(repository.upsertCost).not.toHaveBeenCalled();
  });

  it("answers 422 when the supplier or a reference no longer exists", async () => {
    const { operations, repository, itemRepository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.list.mockResolvedValue(LINES);
    repository.supplierExists.mockResolvedValueOnce(false);

    await expect(operations.confirmPurchase(1)).rejects.toMatchObject({
      status: 422,
    });

    repository.supplierExists.mockResolvedValueOnce(true);
    repository.productExists.mockResolvedValueOnce(false);

    await expect(operations.confirmPurchase(1)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("propagates a stock failure so the caller can roll back", async () => {
    const { operations, repository, itemRepository, stocks } = setup();
    const error = new Error("stock exploded");
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.list.mockResolvedValue(LINES);
    stocks.applyPurchaseItems.mockRejectedValue(error);

    await expect(operations.confirmPurchase(1)).rejects.toThrow(error);
    expect(repository.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "confirmed" }),
      expect.anything(),
    );
  });
});
