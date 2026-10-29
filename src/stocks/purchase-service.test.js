const {
  createPurchaseStockService,
  normalizeItems,
} = require("./purchase-service");

/**
 * Builds a transaction double with the lock mode Sequelize exposes.
 * @returns {object} Transaction double.
 */
function transaction() {
  return { id: "tx-1", LOCK: { UPDATE: "UPDATE" } };
}

describe("normalizeItems", () => {
  it("orders the aggregated pairs by product and item state", () => {
    const items = [
      { product_id: 2, item_state_id: 1, quantity: 1 },
      { product_id: 1, item_state_id: 3, quantity: 2 },
      { product_id: 1, item_state_id: 2, quantity: 4 },
    ];

    expect(normalizeItems(items)).toEqual([
      { product_id: 1, item_state_id: 2, quantity: 4 },
      { product_id: 1, item_state_id: 3, quantity: 2 },
      { product_id: 2, item_state_id: 1, quantity: 1 },
    ]);
  });
});

describe("purchase stock service", () => {
  let model;
  let service;

  beforeEach(() => {
    model = { findOrCreate: jest.fn() };
    service = createPurchaseStockService(model);
  });

  it("creates a missing row with the item quantity inside the transaction", async () => {
    const stored = { id: 1, product_id: 15, item_state_id: 2, quantity: 3 };
    const tx = transaction();
    model.findOrCreate.mockResolvedValue([stored, true]);

    const result = await service.applyPurchaseItems(
      [{ product_id: 15, item_state_id: 2, quantity: 3 }],
      { transaction: tx },
    );

    expect(result).toEqual([stored]);
    expect(model.findOrCreate).toHaveBeenCalledWith({
      where: { product_id: 15, item_state_id: 2 },
      defaults: { quantity: 3 },
      transaction: tx,
      lock: "UPDATE",
    });
  });

  it("atomically increments an existing row without creating it", async () => {
    const stock = { id: 1, increment: jest.fn().mockResolvedValue() };
    const tx = transaction();
    model.findOrCreate.mockResolvedValue([stock, false]);

    await service.applyPurchaseItems(
      [{ product_id: 15, item_state_id: 2, quantity: 4 }],
      { transaction: tx },
    );

    expect(stock.increment).toHaveBeenCalledWith("quantity", {
      by: 4,
      transaction: tx,
    });
  });

  it("aggregates duplicated product and item state pairs", async () => {
    const stock = { id: 1, increment: jest.fn().mockResolvedValue() };
    model.findOrCreate.mockResolvedValue([stock, false]);

    await service.applyPurchaseItems(
      [
        { product_id: 15, item_state_id: 2, quantity: 3 },
        { product_id: 15, item_state_id: 2, quantity: 5 },
      ],
      { transaction: transaction() },
    );

    expect(model.findOrCreate).toHaveBeenCalledTimes(1);
    expect(stock.increment).toHaveBeenCalledWith(
      "quantity",
      expect.objectContaining({ by: 8 }),
    );
  });

  it("does nothing for an empty item list", async () => {
    await expect(
      service.applyPurchaseItems([], { transaction: transaction() }),
    ).resolves.toEqual([]);
    expect(model.findOrCreate).not.toHaveBeenCalled();
  });

  it("requires a transaction", async () => {
    await expect(
      service.applyPurchaseItems([
        { product_id: 1, item_state_id: 1, quantity: 1 },
      ]),
    ).rejects.toThrow("A transaction is required");
    expect(model.findOrCreate).not.toHaveBeenCalled();
  });

  it.each([[null], ["items"], [{}]])(
    "rejects a non-array item list %p",
    async (items) => {
      await expect(
        service.applyPurchaseItems(items, { transaction: transaction() }),
      ).rejects.toThrow("items must be an array");
    },
  );

  it.each([
    [{ product_id: "1", item_state_id: 1, quantity: 1 }, "Invalid product_id"],
    [{ product_id: 1, item_state_id: 0, quantity: 1 }, "Invalid item_state_id"],
    [{ product_id: 1, item_state_id: 1, quantity: 0 }, "Invalid quantity"],
    [{ product_id: 1, item_state_id: 1, quantity: 1.5 }, "Invalid quantity"],
  ])("rejects invalid item %p", async (item, message) => {
    await expect(
      service.applyPurchaseItems([item], { transaction: transaction() }),
    ).rejects.toThrow(message);
    expect(model.findOrCreate).not.toHaveBeenCalled();
  });

  it("propagates persistence errors so the caller can roll back", async () => {
    const error = new Error("database exploded");
    model.findOrCreate.mockRejectedValue(error);

    await expect(
      service.applyPurchaseItems(
        [{ product_id: 1, item_state_id: 1, quantity: 1 }],
        { transaction: transaction() },
      ),
    ).rejects.toThrow(error);
  });
});
