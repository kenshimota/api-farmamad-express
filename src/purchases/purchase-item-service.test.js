const { createPurchaseItemOperations } = require("./purchase-item-service");
const { createServiceSupport } = require("./service-support");
const {
  TRANSACTION,
  itemRepositoryDouble,
  repositoryDouble,
} = require("../../test/helpers/purchase-service-doubles");

/**
 * Builds the line operations with fresh doubles.
 * @returns {object} Operations and doubles.
 */
function setup() {
  const repository = repositoryDouble();
  const itemRepository = itemRepositoryDouble();
  const support = createServiceSupport({ repository, itemRepository });
  const operations = createPurchaseItemOperations({
    repository,
    itemRepository,
    support,
  });

  return { operations, repository, itemRepository };
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
    tax_amount: "0.00",
    total: "0.00",
    ...overrides,
  };
}

/**
 * Builds a stored line.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Line double.
 */
function line(overrides = {}) {
  return {
    id: 4,
    purchase_id: 1,
    product_id: 15,
    item_state_id: 1,
    quantity: 2,
    unit_cost: "10.00",
    subtotal: "20.00",
    tax_amount: "3.20",
    ...overrides,
  };
}

describe("listItems", () => {
  it("returns the lines of a draft", async () => {
    const { operations, repository, itemRepository } = setup();
    const rows = [line()];
    repository.findById.mockResolvedValue(purchase());
    itemRepository.list.mockResolvedValue(rows);

    await expect(operations.listItems(1)).resolves.toBe(rows);
    expect(itemRepository.list).toHaveBeenCalledWith(1);
  });

  it("answers 404 for an unknown purchase", async () => {
    const { operations, repository } = setup();
    repository.findById.mockResolvedValue(null);

    await expect(operations.listItems(99)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("answers 409 for a non-draft purchase", async () => {
    const { operations, repository } = setup();
    repository.findById.mockResolvedValue(purchase({ status: "confirmed" }));

    await expect(operations.listItems(1)).rejects.toMatchObject({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
  });
});

describe("addItem", () => {
  it("creates the line and recalculates the purchase", async () => {
    const { operations, repository, itemRepository } = setup();
    const stored = purchase();
    repository.findByIdForUpdate.mockResolvedValue(stored);
    repository.findById.mockResolvedValue(stored);
    itemRepository.list.mockResolvedValue([line()]);

    await operations.addItem(1, {
      product_id: 15,
      item_state_id: 1,
      quantity: 2,
      unit_cost: 10,
      tax_amount: 3.2,
    });

    expect(itemRepository.create).toHaveBeenCalledWith(
      {
        purchase_id: 1,
        product_id: 15,
        item_state_id: 1,
        quantity: 2,
        unit_cost: "10.00",
        subtotal: "20.00",
        tax_amount: "3.20",
      },
      { transaction: TRANSACTION },
    );
    expect(repository.update).toHaveBeenCalledWith(
      stored,
      { subtotal: "20.00", tax_amount: "3.20", total: "23.20" },
      { transaction: TRANSACTION },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      includeItems: true,
      includeSupplier: false,
      transaction: TRANSACTION,
    });
  });

  it("rejects a duplicated product/item state pair", async () => {
    const { operations, repository, itemRepository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.findByCombination.mockResolvedValue(line());

    await expect(
      operations.addItem(1, {
        product_id: 15,
        item_state_id: 1,
        quantity: 1,
        unit_cost: 1,
        tax_amount: 0,
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Item already exists" },
    });
    expect(itemRepository.create).not.toHaveBeenCalled();
  });

  it("validates the product and item state references", async () => {
    const { operations, repository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    repository.productExists.mockResolvedValue(false);

    await expect(
      operations.addItem(1, {
        product_id: 99,
        item_state_id: 1,
        quantity: 1,
        unit_cost: 1,
        tax_amount: 0,
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { product_id: "Invalid product id" } },
    });
  });
});

describe("updateItem", () => {
  it("updates the quantity and unit cost and recalculates", async () => {
    const { operations, repository, itemRepository } = setup();
    const stored = purchase();
    const storedLine = line();
    repository.findByIdForUpdate.mockResolvedValue(stored);
    repository.findById.mockResolvedValue(stored);
    itemRepository.findById.mockResolvedValue(storedLine);
    itemRepository.list.mockResolvedValue([storedLine]);

    await operations.updateItem(1, 4, {
      quantity: 3,
      unit_cost: 12.5,
      tax_amount: 6,
    });

    expect(itemRepository.update).toHaveBeenCalledWith(
      storedLine,
      {
        quantity: 3,
        unit_cost: "12.50",
        tax_amount: "6.00",
        product_id: 15,
        item_state_id: 1,
        subtotal: "37.50",
      },
      { transaction: TRANSACTION },
    );
    expect(repository.update).toHaveBeenCalledWith(
      stored,
      { subtotal: "37.50", tax_amount: "6.00", total: "43.50" },
      { transaction: TRANSACTION },
    );
  });

  it("preserves the current tax amount when the update omits it", async () => {
    const { operations, repository, itemRepository } = setup();
    const stored = purchase();
    const storedLine = line({ tax_amount: "3.20" });
    repository.findByIdForUpdate.mockResolvedValue(stored);
    repository.findById.mockResolvedValue(stored);
    itemRepository.findById.mockResolvedValue(storedLine);
    itemRepository.list.mockResolvedValue([storedLine]);

    await operations.updateItem(1, 4, { quantity: 3 });

    expect(itemRepository.update).toHaveBeenCalledWith(
      storedLine,
      expect.objectContaining({ tax_amount: "3.20", subtotal: "30.00" }),
      { transaction: TRANSACTION },
    );
    expect(repository.update).toHaveBeenCalledWith(
      stored,
      { subtotal: "30.00", tax_amount: "3.20", total: "33.20" },
      { transaction: TRANSACTION },
    );
  });

  it("answers 404 when the line does not belong to the purchase", async () => {
    const { operations, repository, itemRepository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.findById.mockResolvedValue(null);

    await expect(
      operations.updateItem(1, 99, { quantity: 2 }),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Item not found" },
    });
  });

  it("rejects a combination used by another line", async () => {
    const { operations, repository, itemRepository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.findById.mockResolvedValue(line());
    itemRepository.findByCombination.mockResolvedValue(line({ id: 8 }));

    await expect(
      operations.updateItem(1, 4, { product_id: 20 }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Item already exists" },
    });
  });
});

describe("deleteItem", () => {
  it("removes the line and recalculates the empty purchase", async () => {
    const { operations, repository, itemRepository } = setup();
    const stored = purchase();
    const storedLine = line();
    repository.findByIdForUpdate.mockResolvedValue(stored);
    itemRepository.findById.mockResolvedValue(storedLine);
    itemRepository.list.mockResolvedValue([]);

    await expect(operations.deleteItem(1, 4)).resolves.toBeUndefined();

    expect(itemRepository.remove).toHaveBeenCalledWith(storedLine, {
      transaction: TRANSACTION,
    });
    expect(repository.update).toHaveBeenCalledWith(
      stored,
      { subtotal: "0.00", tax_amount: "0.00", total: "0.00" },
      { transaction: TRANSACTION },
    );
  });

  it("answers 404 when the line is missing and 409 when not editable", async () => {
    const { operations, repository, itemRepository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    itemRepository.findById.mockResolvedValue(null);

    await expect(operations.deleteItem(1, 99)).rejects.toMatchObject({
      status: 404,
    });

    repository.findByIdForUpdate.mockResolvedValue(
      purchase({ status: "cancelled" }),
    );

    await expect(operations.deleteItem(1, 4)).rejects.toMatchObject({
      status: 409,
    });
  });
});
