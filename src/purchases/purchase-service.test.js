const Currency = require("../models/currency");
const { createPurchaseService } = require("./purchase-service");
const {
  TRANSACTION,
  itemRepositoryDouble,
  repositoryDouble,
  stocksDouble,
} = require("../../test/helpers/purchase-service-doubles");
const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
};

/**
 * Builds the service with fresh doubles.
 * @param {object} [overrides] - Dependency overrides.
 * @returns {object} The service and its doubles.
 */
function setup(overrides = {}) {
  const repository = overrides.repository ?? repositoryDouble();
  const itemRepository = overrides.itemRepository ?? itemRepositoryDouble();
  const stocks = overrides.stocks ?? stocksDouble();
  const clock = overrides.clock ?? (() => new Date("2026-10-29T10:00:00Z"));
  const service = createPurchaseService({
    repository,
    itemRepository,
    stocks,
    clock,
  });

  return { service, repository, itemRepository, stocks, clock };
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
    currency_id: 3,
    status: "draft",
    subtotal: "0.00",
    tax_amount: "0.00",
    total: "0.00",
    notes: null,
    confirmed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.spyOn(Currency, "findOne").mockResolvedValue(CURRENCY);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("createPurchase", () => {
  it("assigns the next number and calculates every total in cents", async () => {
    const { service, repository, itemRepository } = setup();
    const stored = purchase({
      subtotal: "837.50",
      tax_amount: "134.00",
      total: "971.50",
      notes: "Reposición mensual",
    });
    repository.nextNumber.mockResolvedValue(7);
    repository.findById.mockResolvedValue(stored);

    const result = await service.createPurchase({
      supplier_id: 2,
      notes: "Reposición mensual",
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 40,
          unit_cost: 20,
          tax_amount: 128,
        },
        {
          product_id: 15,
          item_state_id: 2,
          quantity: 3,
          unit_cost: 12.5,
          tax_amount: 6,
        },
      ],
    });

    expect(result).toBe(stored);
    expect(repository.nextNumber).toHaveBeenCalledWith(TRANSACTION);
    expect(repository.create).toHaveBeenCalledWith(
      {
        number: 7,
        supplier_id: 2,
        currency_id: 3,
        status: "draft",
        subtotal: "837.50",
        tax_amount: "134.00",
        total: "971.50",
        notes: "Reposición mensual",
      },
      { transaction: TRANSACTION },
    );
    expect(itemRepository.createMany).toHaveBeenCalledWith(
      [
        {
          purchase_id: 1,
          product_id: 15,
          item_state_id: 1,
          quantity: 40,
          unit_cost: "20.00",
          subtotal: "800.00",
          tax_amount: "128.00",
        },
        {
          purchase_id: 1,
          product_id: 15,
          item_state_id: 2,
          quantity: 3,
          unit_cost: "12.50",
          subtotal: "37.50",
          tax_amount: "6.00",
        },
      ],
      { transaction: TRANSACTION },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      includeItems: true,
      includeSupplier: false,
      transaction: TRANSACTION,
    });
  });

  it("creates an empty draft with zero totals and no tax rate", async () => {
    const { service, repository, itemRepository } = setup();
    repository.findById.mockResolvedValue(purchase());

    await service.createPurchase({ supplier_id: 2 });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: "0.00",
        tax_amount: "0.00",
        total: "0.00",
      }),
      { transaction: TRANSACTION },
    );
    expect(repository.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ tax_rate: expect.anything() }),
      expect.anything(),
    );
    expect(itemRepository.createMany).not.toHaveBeenCalled();
  });

  it("uses an explicit active currency", async () => {
    const { service, repository } = setup();
    const other = { id: 7, code: "VES", name: "Bolívar", symbol: "Bs" };
    Currency.findOne.mockResolvedValue(other);
    repository.findById.mockResolvedValue(purchase({ currency_id: 7 }));

    await service.createPurchase({ supplier_id: 2, currency_id: 7 });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency_id: 7 }),
      { transaction: TRANSACTION },
    );
  });

  it("rejects an invalid currency and a missing default", async () => {
    const { service, repository } = setup();
    Currency.findOne.mockResolvedValue(null);

    await expect(
      service.createPurchase({ supplier_id: 2, currency_id: 99 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { currency_id: "Invalid currency" } },
    });

    await expect(
      service.createPurchase({ supplier_id: 2 }),
    ).rejects.toMatchObject({
      status: 503,
      body: {
        message: "Default transaction currency is not configured",
      },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicated product/item state pairs before opening a transaction", async () => {
    const { service, repository } = setup();

    await expect(
      service.createPurchase({
        supplier_id: 2,
        items: [
          { product_id: 1, item_state_id: 1, quantity: 1, unit_cost: 1 },
          { product_id: 1, item_state_id: 1, quantity: 2, unit_cost: 2 },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Item already exists" },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("answers 422 when the supplier does not exist", async () => {
    const { service, repository } = setup();
    repository.supplierExists.mockResolvedValue(false);

    await expect(
      service.createPurchase({ supplier_id: 99 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { supplier_id: "Invalid supplier id" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("answers 422 for a missing product and item state reference", async () => {
    const { service, repository } = setup();
    repository.productExists.mockResolvedValue(false);

    await expect(
      service.createPurchase({
        supplier_id: 2,
        items: [
          { product_id: 99, item_state_id: 1, quantity: 1, unit_cost: 1 },
        ],
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { "items.0.product_id": "Invalid product id" } },
    });

    repository.productExists.mockResolvedValue(true);
    repository.itemStateExists.mockResolvedValue(false);

    await expect(
      service.createPurchase({
        supplier_id: 2,
        items: [
          { product_id: 1, item_state_id: 99, quantity: 1, unit_cost: 1 },
        ],
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { "items.0.item_state_id": "Invalid item state id" } },
    });
  });
});

describe("read operations", () => {
  it("lists purchases with the received filters", async () => {
    const { service, repository } = setup();
    const rows = [purchase()];
    repository.list.mockResolvedValue(rows);

    await expect(
      service.listPurchases({ supplierId: 2, status: "draft" }),
    ).resolves.toBe(rows);
    expect(repository.list).toHaveBeenCalledWith({
      supplierId: 2,
      status: "draft",
    });
  });

  it("returns one purchase with items and supplier", async () => {
    const { service, repository } = setup();
    const stored = purchase({ items: [], supplier: { id: 2 } });
    repository.findById.mockResolvedValue(stored);

    await expect(service.getPurchase(1)).resolves.toBe(stored);
    expect(repository.findById).toHaveBeenCalledWith(1, {
      includeItems: true,
      includeSupplier: true,
    });
  });

  it("answers 404 for an unknown purchase", async () => {
    const { service, repository } = setup();
    repository.findById.mockResolvedValue(null);

    await expect(service.getPurchase(99)).rejects.toMatchObject({
      status: 404,
      body: { message: "Purchase not found" },
    });
  });
});
